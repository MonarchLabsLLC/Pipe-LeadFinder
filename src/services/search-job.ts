import { z } from "zod"
import type { SearchType } from "@/generated/prisma/enums"
import type { CreditAction } from "@/services/credits-service"
import { prisma } from "@/lib/prisma"
import { createAndEnqueueJob, updateJobProgress } from "@/lib/jobs/service"
import {
  assertSearchConfigured,
  executeSearch,
} from "@/services/search-service"
import {
  markSearchFailed,
  persistSearchResults,
  type DuplicatePolicy,
} from "@/services/search-persistence"
import { deductCredits } from "@/lib/credit-guard"
import {
  requireApprovedJob,
  chargeApprovedJob,
} from "@/server/focused-agent/job-guard"

const searchJobPayloadSchema = z.object({
  userId: z.string().min(1),
  userEmail: z.string().email().nullable().optional(),
  searchId: z.string().min(1),
  listId: z.string().min(1),
  searchType: z.enum(["PEOPLE", "LOCAL", "COMPANY", "DOMAIN", "INFLUENCER"]),
  searchParams: z.record(z.string(), z.unknown()),
  duplicatePolicy: z.enum(["ONLY_NEW", "ADD_EXISTING", "RETURN_ALL"]),
  focusedAgentApprovalId: z.string().uuid().optional(),
})

export type SearchJobPayload = z.infer<typeof searchJobPayloadSchema>

function creditAction(type: SearchType): CreditAction {
  const actions: Record<SearchType, CreditAction> = {
    PEOPLE: "search:people",
    LOCAL: "search:local",
    COMPANY: "search:company",
    DOMAIN: "search:domain",
    INFLUENCER: "search:influencer",
  }
  return actions[type]
}

function billableCount(
  type: SearchType,
  leads: Array<{ email: string | null }>
) {
  if (type === "LOCAL" || type === "DOMAIN") {
    return leads.filter((lead) => Boolean(lead.email)).length
  }
  return leads.length
}

export async function enqueueSearchJob(input: {
  userId: string
  userEmail?: string | null
  searchType: SearchType
  listId: string
  searchParams: Record<string, unknown>
  duplicatePolicy?: DuplicatePolicy
  idempotencyKey?: string | null
  focusedAgentApprovalId?: string
}) {
  assertSearchConfigured(input.searchType, input.searchParams)
  if (input.idempotencyKey) {
    const existing = await prisma.jobRun.findUnique({
      where: {
        userId_idempotencyKey: {
          userId: input.userId,
          idempotencyKey: input.idempotencyKey.trim(),
        },
      },
      include: { search: true },
    })
    if (existing?.search) return { search: existing.search, job: existing }
  }
  const search = await prisma.searchHistory.create({
    data: {
      userId: input.userId,
      listId: input.listId,
      searchType: input.searchType,
      parameters: JSON.parse(
        JSON.stringify({
          ...input.searchParams,
          duplicatePolicy: input.duplicatePolicy ?? "ONLY_NEW",
        })
      ),
      status: "PENDING",
    },
  })

  try {
    const job = await createAndEnqueueJob({
      userId: input.userId,
      kind: "SEARCH",
      idempotencyKey: input.idempotencyKey || undefined,
      listId: input.listId,
      searchId: search.id,
      ...(input.focusedAgentApprovalId ? { retryLimit: 0 } : {}),
      payload: JSON.parse(
        JSON.stringify({
          userId: input.userId,
          userEmail: input.userEmail ?? null,
          searchId: search.id,
          listId: input.listId,
          searchType: input.searchType,
          searchParams: input.searchParams,
          duplicatePolicy: input.duplicatePolicy ?? "ONLY_NEW",
          ...(input.focusedAgentApprovalId
            ? { focusedAgentApprovalId: input.focusedAgentApprovalId }
            : {}),
        })
      ),
    })
    if (job.searchId !== search.id) {
      await prisma.searchHistory.delete({ where: { id: search.id } })
      const existingSearch = job.searchId
        ? await prisma.searchHistory.findUnique({ where: { id: job.searchId } })
        : null
      if (!existingSearch)
        throw new Error("Idempotent search job is missing its search record")
      return { search: existingSearch, job }
    }
    return { search, job }
  } catch (error) {
    await markSearchFailed(search.id)
    throw error
  }
}

export async function processSearchJob(jobRunId: string) {
  const jobRun = await prisma.jobRun.findUnique({ where: { id: jobRunId } })
  if (!jobRun) throw new Error("Search job not found")
  const payload = searchJobPayloadSchema.parse(jobRun.payload)
  const approval = payload.focusedAgentApprovalId
    ? await requireApprovedJob(jobRunId)
    : null
  const searchRecord = await prisma.searchHistory.findUnique({
    where: { id: payload.searchId },
    select: { apifyRunId: true },
  })

  await Promise.all([
    prisma.searchHistory.update({
      where: { id: payload.searchId },
      data: { status: "RUNNING" },
    }),
    updateJobProgress(jobRunId, {
      stage: "Running provider search",
      current: 0,
      total: 3,
      status: "RUNNING",
    }),
  ])

  try {
    const results = await executeSearch(
      payload.searchType,
      payload.searchParams,
      {
        existingRunId: searchRecord?.apifyRunId,
        onRunStarted: async (apifyRunId) => {
          await prisma.searchHistory.update({
            where: { id: payload.searchId },
            data: { apifyRunId },
          })
        },
      }
    )
    await updateJobProgress(jobRunId, {
      stage: "Saving unique leads",
      current: 1,
      total: 3,
    })

    if (approval) await requireApprovedJob(jobRunId)
    if (approval && results.length > approval.cost.maximumUnits)
      throw new Error(
        "The provider exceeded the approved result limit; nothing was saved or charged"
      )
    const leads = await persistSearchResults({
      searchId: payload.searchId,
      userId: payload.userId,
      listId: payload.listId,
      searchType: payload.searchType,
      results,
      duplicatePolicy: payload.duplicatePolicy,
      ...(approval
        ? {
            expectedListVersion: (
              approval.versions.list as { updatedAt: string }
            ).updatedAt,
          }
        : {}),
    })

    await updateJobProgress(jobRunId, {
      stage: "Recording credit usage",
      current: 2,
      total: 3,
    })
    const charged = billableCount(payload.searchType, leads)
    if (approval)
      await chargeApprovedJob(
        approval,
        charged,
        `focused-agent:${approval.proposalId}:search`
      )
    else
      await deductCredits(
        payload.userId,
        creditAction(payload.searchType),
        charged,
        {
          listId: payload.listId,
          searchType: payload.searchType,
          searchId: payload.searchId,
          jobRunId,
        },
        payload.userEmail
      )

    await updateJobProgress(jobRunId, {
      stage: "Completed",
      current: 3,
      total: 3,
    })
    return {
      searchId: payload.searchId,
      listId: payload.listId,
      providerResultCount: results.length,
      resultCount: leads.length,
      duplicateCount: Math.max(0, results.length - leads.length),
      billableCount: charged,
    }
  } catch (error) {
    await markSearchFailed(payload.searchId)
    throw error
  }
}
