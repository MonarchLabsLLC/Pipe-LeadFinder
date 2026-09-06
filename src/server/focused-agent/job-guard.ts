import { prisma } from "@/lib/prisma"
import type { PipeLeadsCreditAction } from "@/lib/pipeleads-credit-pricing"
import { assertWrites, resolveActor, type AgentActor } from "./access"
import { buildPlan, type PlanAction } from "./plans"
import { requireCredits, chargeApprovedUnits } from "./pricing"
import { exactHash, hashCanonical, FocusedAgentError } from "./security"
import { ownedList } from "./resources"

export type ApprovedJob = {
  actor: AgentActor
  proposalId: string
  cost: {
    creditsPerUnit: number
    maximumUnits: number
    action: PipeLeadsCreditAction
  }
  versions: Record<string, unknown>
}
export async function requireApprovedJob(
  jobId: string,
  checkVersions = true
): Promise<ApprovedJob> {
  assertWrites()
  const job = await prisma.jobRun.findUniqueOrThrow({ where: { id: jobId } })
  if (!["QUEUED", "RUNNING"].includes(job.status))
    throw new FocusedAgentError(
      "JOB_NOT_EXECUTABLE",
      "This approved job finished or requires review and cannot be repeated.",
      409
    )
  const payload = job.payload as {
    focusedAgentApprovalId?: string
    userId: string
    listId: string
    searchType?: string
    searchParams?: unknown
    duplicatePolicy?: string
    entryIds?: string[]
    action?: string
  }
  const p = await prisma.focusedAgentApproval.findFirst({
    where: { id: payload.focusedAgentApprovalId ?? "", userId: job.userId },
  })
  if (
    !p ||
    !p.approvedAt ||
    p.approvedAt > p.expiresAt ||
    !["native-ui", "mcp-elicitation"].includes(p.approvalMethod ?? "") ||
    !["approved", "queued"].includes(p.status) ||
    job.idempotencyKey !== `focused-agent:${p.id}` ||
    payload.userId !== p.userId
  )
    throw new FocusedAgentError(
      "HUMAN_APPROVAL_REQUIRED",
      "The job does not have a valid recorded human approval."
    )
  const hash = hashCanonical({
    actor: p.userId,
    workspace: p.workspaceId,
    action: p.action,
    input: p.input,
    preview: p.preview,
    versions: p.versions,
    expiresAt: p.expiresAt.toISOString(),
  })
  if (!exactHash(p.proposalHash, hash))
    throw new FocusedAgentError(
      "PROPOSAL_INTEGRITY_ERROR",
      "The approved preview was changed.",
      409
    )
  const actor = await resolveActor(
    p.subject,
    p.origin as AgentActor["origin"],
    p.workspaceId
  )
  if (actor.userId !== p.userId)
    throw new FocusedAgentError(
      "ACTOR_CHANGED",
      "The original user is no longer available."
    )
  const list = await ownedList(actor, payload.listId, true)
  const listVersion = (p.versions as { list: unknown }).list
  if (
    hashCanonical({
      id: list.id,
      updatedAt: list.updatedAt.toISOString(),
      type: list.type,
      status: list.status,
    }) !== hashCanonical(listVersion)
  )
    throw new FocusedAgentError(
      "STALE_PROPOSAL",
      "The approved list changed. Prepare a fresh preview.",
      409
    )
  const input = p.input as {
    type?: string
    parameters?: {
      listId: string
      duplicatePolicy: string
      [key: string]: unknown
    }
    listId?: string
    field?: string
  }
  const preview = p.preview as {
    cost: ApprovedJob["cost"]
    eligibleLeadIds?: string[]
  }
  if (p.action === "search") {
    const { listId, duplicatePolicy, ...searchParams } = input.parameters!
    if (
      payload.listId !== listId ||
      payload.searchType !== input.type ||
      payload.duplicatePolicy !== duplicatePolicy ||
      hashCanonical(payload.searchParams) !== hashCanonical(searchParams)
    )
      throw new FocusedAgentError(
        "JOB_BINDING_MISMATCH",
        "The queued search differs from the approved request."
      )
  } else {
    const expectedAction =
      p.action === "score"
        ? "SCORE"
        : input.field === "phone"
          ? "ENRICH_PHONE"
          : "ENRICH_EMAIL"
    const entries = await prisma.leadListEntry.findMany({
      where: {
        id: { in: payload.entryIds ?? [] },
        listId: input.listId,
        list: { userId: actor.userId },
        lead: { userId: actor.userId },
      },
      select: { leadId: true },
    })
    if (
      payload.listId !== input.listId ||
      payload.action !== expectedAction ||
      hashCanonical(entries.map((e) => e.leadId).sort()) !==
        hashCanonical([...(preview.eligibleLeadIds ?? [])].sort())
    )
      throw new FocusedAgentError(
        "JOB_BINDING_MISMATCH",
        "The queued selection differs from the approved records."
      )
  }
  if (checkVersions || p.action === "score") {
    const current = await buildPlan(actor, p.action as PlanAction, p.input)
    if (
      hashCanonical(current.versions) !== hashCanonical(p.versions) ||
      hashCanonical(current.preview) !== hashCanonical(p.preview)
    )
      throw new FocusedAgentError(
        "STALE_PROPOSAL",
        "Records, pricing or business context changed before the job began. Prepare a new preview.",
        409
      )
    await requireCredits(
      actor,
      (preview.cost as { maximumCredits?: number }).maximumCredits ?? 0
    )
  }
  return {
    actor,
    proposalId: p.id,
    cost: preview.cost,
    versions: p.versions as Record<string, unknown>,
  }
}
export async function chargeApprovedJob(
  approval: ApprovedJob,
  units: number,
  key: string
) {
  return chargeApprovedUnits(
    approval.actor,
    approval.proposalId,
    approval.cost,
    units,
    key
  )
}
