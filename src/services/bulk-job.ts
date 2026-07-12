import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { createAndEnqueueJob, updateJobProgress } from "@/lib/jobs/service"
import { enrichEmail, enrichPhone } from "@/services/enrich-service"
import { scoreLeadsForList } from "@/services/lead-scoring-service"
import { deductCredits } from "@/lib/credit-guard"

const payloadSchema = z.object({
  userId: z.string().min(1),
  userEmail: z.string().email().nullable().optional(),
  listId: z.string().min(1),
  entryIds: z.array(z.string().min(1)).min(1).max(1_000),
  action: z.enum(["ENRICH_EMAIL", "ENRICH_PHONE", "SCORE"]),
})

type BackgroundBulkAction = z.infer<typeof payloadSchema>["action"]

const KIND_BY_ACTION = {
  ENRICH_EMAIL: "BULK_ENRICH_EMAIL",
  ENRICH_PHONE: "BULK_ENRICH_PHONE",
  SCORE: "BULK_SCORE",
} as const

export async function enqueueBulkJob(input: {
  userId: string
  userEmail?: string | null
  listId: string
  entryIds: string[]
  action: BackgroundBulkAction
  idempotencyKey?: string | null
}) {
  const entries = await prisma.leadListEntry.findMany({
    where: {
      id: { in: input.entryIds },
      listId: input.listId,
      list: { userId: input.userId },
    },
    select: { id: true, leadId: true },
  })
  if (entries.length !== new Set(input.entryIds).size) {
    throw new Error("One or more selected leads are invalid")
  }

  const job = await createAndEnqueueJob({
    userId: input.userId,
    kind: KIND_BY_ACTION[input.action],
    idempotencyKey: input.idempotencyKey || undefined,
    listId: input.listId,
    payload: {
      userId: input.userId,
      userEmail: input.userEmail ?? null,
      listId: input.listId,
      entryIds: entries.map((entry) => entry.id),
      action: input.action,
    },
  })

  await prisma.jobItem.createMany({
    data: entries.map((entry) => ({
      jobRunId: job.id,
      subjectType: "LEAD",
      subjectId: entry.leadId,
      action: input.action,
    })),
    skipDuplicates: true,
  })
  return job
}

export async function processBulkJob(jobRunId: string) {
  const jobRun = await prisma.jobRun.findUnique({ where: { id: jobRunId } })
  if (!jobRun) throw new Error("Bulk job not found")
  const payload = payloadSchema.parse(jobRun.payload)
  const entries = await prisma.leadListEntry.findMany({
    where: {
      id: { in: payload.entryIds },
      listId: payload.listId,
      list: { userId: payload.userId },
    },
    include: { lead: true },
  })
  await updateJobProgress(jobRunId, {
    stage: payload.action === "SCORE" ? "Scoring selected leads" : "Enriching selected leads",
    current: 0,
    total: entries.length,
    status: "RUNNING",
  })

  if (payload.action === "SCORE") {
    let scoredCount = 0
    for (let index = 0; index < entries.length; index += 25) {
      const batch = entries.slice(index, index + 25).map((entry) => entry.lead)
      const result = await scoreLeadsForList({
        userId: payload.userId,
        email: payload.userEmail,
        listId: payload.listId,
        leads: batch,
        idempotencyKey: `${jobRunId}:score:${index}`,
      })
      scoredCount += result.scoredCount
      await updateJobProgress(jobRunId, {
        current: Math.min(index + batch.length, entries.length),
        total: entries.length,
      })
    }
    return { attempted: entries.length, scoredCount }
  }

  let enriched = 0
  let failed = 0
  for (let index = 0; index < entries.length; index += 3) {
    const batch = entries.slice(index, index + 3)
    const outcomes = await Promise.allSettled(
      batch.map(async (entry) => {
        const item = await prisma.jobItem.findFirst({
          where: { jobRunId, subjectId: entry.leadId, action: payload.action },
        })
        if (item?.status === "COMPLETED") return false
        await prisma.jobItem.updateMany({
          where: { jobRunId, subjectId: entry.leadId, action: payload.action },
          data: { status: "RUNNING", errorMessage: null },
        })
        try {
          const updated = payload.action === "ENRICH_EMAIL"
            ? await enrichEmail(entry.leadId)
            : await enrichPhone(entry.leadId)
          const found = payload.action === "ENRICH_EMAIL"
            ? updated.emailStatus === "FOUND" || updated.emailStatus === "POTENTIAL"
            : updated.phoneStatus === "FOUND"
          if (found && !item?.billedAt) {
            await deductCredits(
              payload.userId,
              payload.action === "ENRICH_EMAIL" ? "enrich:email" : "enrich:phone",
              1,
              { listId: payload.listId, leadId: entry.leadId, jobRunId },
              payload.userEmail
            )
          }
          await prisma.jobItem.updateMany({
            where: { jobRunId, subjectId: entry.leadId, action: payload.action },
            data: {
              status: "COMPLETED",
              billedAt: found ? new Date() : undefined,
              result: { found },
            },
          })
          return found
        } catch (error) {
          await prisma.jobItem.updateMany({
            where: { jobRunId, subjectId: entry.leadId, action: payload.action },
            data: {
              status: "FAILED",
              errorMessage: error instanceof Error ? error.message : "Enrichment failed",
            },
          })
          throw error
        }
      })
    )
    enriched += outcomes.filter(
      (outcome) => outcome.status === "fulfilled" && outcome.value
    ).length
    failed += outcomes.filter((outcome) => outcome.status === "rejected").length
    await updateJobProgress(jobRunId, {
      current: Math.min(index + batch.length, entries.length),
      total: entries.length,
    })
  }

  return { attempted: entries.length, enriched, failed }
}
