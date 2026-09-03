import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { publicJobRun } from "@/lib/jobs/service"
import { listResources, getList, id, leadSelectionSchema } from "./resources"
import { prepareSearchSchema, enrichSchema } from "./plans"
import { prepareProposal } from "./proposals"
import { FocusedAgentError } from "./security"
import type { AgentActor } from "./access"
import { recoverApprovedJob } from "./job-recovery"

export const actions = {
  list_resources: {
    description:
      "Find your existing saved prospect lists. No paid search is started.",
    schema: z
      .object({
        query: z.string().max(200).optional(),
        limit: z.number().int().min(1).max(50).optional(),
      })
      .strict(),
  },
  get_list: {
    description: "Read actual saved leads in an owned list, with pagination.",
    schema: z
      .object({
        listId: id,
        cursor: id.optional(),
        limit: z.number().int().min(1).max(50).optional(),
      })
      .strict(),
  },
  prepare_search: {
    description:
      "Preview one paid search in an existing matching list. Interview for missing criteria first. No work starts until the human approves.",
    schema: prepareSearchSchema,
  },
  prepare_enrichment: {
    description:
      "Preview the exact selected leads, skipped records and maximum cost to find missing email or phone details. Requires human approval.",
    schema: enrichSchema,
  },
  prepare_scoring: {
    description:
      "Preview scoring for exact selected leads. Uses existing business context and token-metered AI. Requires human approval.",
    schema: leadSelectionSchema,
  },
  get_run: {
    description:
      "Read progress/results of an approved background job owned by this user.",
    schema: z.object({ runId: id }).strict(),
  },
}
export async function getApprovedJob(a: AgentActor, jobId: string) {
  let job = await prisma.jobRun.findFirst({
    where: { id: jobId, userId: a.userId },
  })
  const proposalId = (
    job?.payload as { focusedAgentApprovalId?: string } | null
  )?.focusedAgentApprovalId
  const approval = proposalId
    ? await prisma.focusedAgentApproval.findFirst({
        where: { id: proposalId, userId: a.userId, workspaceId: a.workspaceId },
      })
    : null
  if (!job || !approval)
    throw new FocusedAgentError(
      "RUN_NOT_FOUND",
      "This approved job is not available.",
      404
    )
  job = await recoverApprovedJob(job)
  return {
    ...publicJobRun(job),
    runId: job.id,
    status: job.status.toLowerCase(),
    url: job.listId
      ? `/lead-search/saved-lists/${encodeURIComponent(job.listId)}`
      : null,
  }
}
export async function dispatch(
  a: AgentActor,
  name: string,
  raw: unknown,
  context: {
    key: string
    threadId?: string
    allowedIds?: string[]
    leadIds?: string[]
  }
) {
  if (!Object.hasOwn(actions, name))
    throw new FocusedAgentError(
      "UNSUPPORTED_ACTION",
      "This Agent action is not supported.",
      400
    )
  const input = actions[name as keyof typeof actions].schema.parse(raw)
  const listId =
    "listId" in input
      ? input.listId
      : name === "prepare_search"
        ? (input as z.infer<typeof prepareSearchSchema>).parameters.listId
        : undefined
  if (
    listId &&
    context.allowedIds &&
    !context.allowedIds.includes(String(listId))
  )
    throw new FocusedAgentError(
      "RESOURCE_SELECTION_REQUIRED",
      "Select that saved list before asking me to use it.",
      409
    )
  if (
    "leadIds" in input &&
    context.leadIds?.length &&
    input.leadIds.some((leadId) => !context.leadIds!.includes(leadId))
  )
    throw new FocusedAgentError(
      "SELECTION_MISMATCH",
      "This request includes leads outside your visible selection.",
      409
    )
  if (name === "list_resources") {
    const v = input as z.infer<typeof actions.list_resources.schema>
    return listResources(a, v.query, v.limit)
  }
  if (name === "get_list") {
    const v = input as z.infer<typeof actions.get_list.schema>
    return getList(a, { ...v, limit: v.limit ?? 50 })
  }
  if (name === "get_run")
    return getApprovedJob(a, (input as { runId: string }).runId)
  return prepareProposal(
    a,
    name === "prepare_search"
      ? "search"
      : name === "prepare_enrichment"
        ? "enrich"
        : "score",
    input,
    context.key,
    context.threadId
  )
}
