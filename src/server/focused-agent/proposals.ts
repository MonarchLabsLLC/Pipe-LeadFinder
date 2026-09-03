import { prisma } from "@/lib/prisma"
import { enqueueSearchJob } from "@/services/search-job"
import { enqueueBulkJob } from "@/services/bulk-job"
import { publicJobRun } from "@/lib/jobs/service"
import type { FocusedAgentApproval } from "@/generated/prisma/client"
import { resolveActor, assertWrites, type AgentActor } from "./access"
import { buildPlan, type PlanAction } from "./plans"
import { requireCredits } from "./pricing"
import { json } from "./resources"
import { exactHash, hashCanonical, FocusedAgentError } from "./security"
import { recoverApprovedJob } from "./job-recovery"

export async function getProposal(a: AgentActor, id: string) {
  const p = await prisma.focusedAgentApproval.findFirst({
    where: { id, userId: a.userId, workspaceId: a.workspaceId },
  })
  if (!p)
    throw new FocusedAgentError(
      "PROPOSAL_NOT_FOUND",
      "This proposal is not available.",
      404
    )
  return p
}
export async function proposalView(p: FocusedAgentApproval) {
  if (
    p.status === "approved" &&
    !(p.result as { jobId?: string } | null)?.jobId
  ) {
    const queued = await prisma.jobRun.findUnique({
      where: {
        userId_idempotencyKey: {
          userId: p.userId,
          idempotencyKey: `focused-agent:${p.id}`,
        },
      },
    })
    if (queued) {
      await prisma.focusedAgentApproval.updateMany({
        where: { id: p.id, status: "approved" },
        data: {
          status: "queued",
          result: {
            jobId: queued.id,
            url: `/lead-search/saved-lists/${encodeURIComponent(queued.listId ?? "")}`,
          },
        },
      })
      p = await prisma.focusedAgentApproval.findUniqueOrThrow({
        where: { id: p.id },
      })
    } else if (p.approvedAt && p.approvedAt.getTime() < Date.now() - 90000) {
      await prisma.focusedAgentApproval.updateMany({
        where: { id: p.id, status: "approved" },
        data: {
          status: "needs_review",
          result: {
            error:
              "Queue submission was interrupted. No recorded job was found; this approval will not be replayed automatically.",
          },
        },
      })
      p = await prisma.focusedAgentApproval.findUniqueOrThrow({
        where: { id: p.id },
      })
    }
  }
  const url = process.env.AUTH_URL || process.env.NEXTAUTH_URL
  const result = p.result as { jobId?: string } | null
  const recorded = result?.jobId
    ? await prisma.jobRun.findFirst({
        where: { id: result.jobId, userId: p.userId },
      })
    : null
  const job = recorded ? await recoverApprovedJob(recorded) : null
  return {
    id: p.id,
    proposalHash: p.proposalHash,
    workspaceId: p.workspaceId,
    status: job ? job.status.toLowerCase() : p.status,
    preview: p.preview,
    expiresAt: p.expiresAt.toISOString(),
    result: p.result,
    warnings: ["Review the exact records, cost and effects before approval."],
    approvalUrl: `${url ? new URL(url).origin : ""}/lead-search/saved-lists?agentApproval=${p.id}`,
    job: job ? publicJobRun(job) : null,
  }
}
export function proposalHash(p: {
  userId: string
  workspaceId: string
  action: string
  input: unknown
  preview: unknown
  versions: unknown
  expiresAt: Date
}) {
  return hashCanonical({
    actor: p.userId,
    workspace: p.workspaceId,
    action: p.action,
    input: p.input,
    preview: p.preview,
    versions: p.versions,
    expiresAt: p.expiresAt.toISOString(),
  })
}
export async function prepareProposal(
  a: AgentActor,
  action: PlanAction,
  raw: unknown,
  key: string,
  threadId?: string
) {
  assertWrites()
  const plan = await buildPlan(a, action, raw)
  const cost = plan.preview.cost as { maximumCredits?: number }
  await requireCredits(a, cost.maximumCredits ?? 0)
  const where = {
    userId_workspaceId_idempotencyKey: {
      userId: a.userId,
      workspaceId: a.workspaceId,
      idempotencyKey: key,
    },
  }
  const existing = await prisma.focusedAgentApproval.findUnique({ where })
  if (existing) {
    if (
      existing.action !== action ||
      hashCanonical(existing.input) !== hashCanonical(plan.input)
    )
      throw new FocusedAgentError(
        "IDEMPOTENCY_CONFLICT",
        "This request ID was already used for another proposal.",
        409
      )
    return proposalView(existing)
  }
  const data = {
    userId: a.userId,
    workspaceId: a.workspaceId,
    subject: a.subject,
    origin: a.origin,
    threadId,
    action,
    input: json(plan.input),
    preview: json(plan.preview),
    versions: json(plan.versions),
    expiresAt: new Date(Date.now() + 900000),
    idempotencyKey: key,
  }
  const p = await prisma.focusedAgentApproval.create({
    data: { ...data, proposalHash: proposalHash(data) },
  })
  await prisma.focusedAgentAudit.create({
    data: {
      userId: a.userId,
      workspaceId: a.workspaceId,
      action,
      outcome: "prepared",
      metadata: { proposalId: p.id },
    },
  })
  return proposalView(p)
}

/** Only authenticated UI decisions and signed MCP human approval call this function. */
export async function decideProposal(
  a: AgentActor,
  id: string,
  hash: string,
  decision: "approve" | "reject"
) {
  const actor = await resolveActor(a.subject, a.origin, a.workspaceId)
  const p = await getProposal(actor, id)
  if (p.subject !== actor.subject)
    throw new FocusedAgentError(
      "ACTOR_CHANGED",
      "This approval belongs to a different verified identity."
    )
  if (!exactHash(hash, p.proposalHash) || !exactHash(hash, proposalHash(p)))
    throw new FocusedAgentError(
      "PROPOSAL_HASH_MISMATCH",
      "Review the current immutable preview.",
      409
    )
  if (p.status !== "pending") return proposalView(p)
  if (decision === "reject") {
    await prisma.focusedAgentApproval.updateMany({
      where: { id, status: "pending" },
      data: { status: "rejected" },
    })
    await prisma.focusedAgentAudit.create({
      data: {
        userId: actor.userId,
        workspaceId: actor.workspaceId,
        action: p.action,
        outcome: "rejected",
        metadata: { proposalId: id },
      },
    })
    return proposalView(await getProposal(actor, id))
  }
  assertWrites()
  if (p.expiresAt <= new Date())
    throw new FocusedAgentError(
      "PROPOSAL_EXPIRED",
      "This preview expired. Prepare a new one.",
      409
    )
  const fresh = await buildPlan(actor, p.action as PlanAction, p.input)
  if (
    hashCanonical(fresh.versions) !== hashCanonical(p.versions) ||
    hashCanonical(fresh.preview) !== hashCanonical(p.preview)
  )
    throw new FocusedAgentError(
      "STALE_PROPOSAL",
      "Records, pricing or business context changed. Prepare a new preview.",
      409
    )
  await requireCredits(
    actor,
    (fresh.preview.cost as { maximumCredits?: number }).maximumCredits ?? 0
  )
  const approvedAt = new Date()
  const claimed = await prisma.focusedAgentApproval.updateMany({
    where: {
      id,
      userId: actor.userId,
      workspaceId: actor.workspaceId,
      status: "pending",
      proposalHash: hash,
      expiresAt: { gt: approvedAt },
    },
    data: {
      status: "approved",
      approvedAt,
      approvalMethod:
        actor.origin === "native" ? "native-ui" : "mcp-elicitation",
    },
  })
  if (!claimed.count) return proposalView(await getProposal(actor, id))
  await prisma.focusedAgentAudit.create({
    data: {
      userId: actor.userId,
      workspaceId: actor.workspaceId,
      action: p.action,
      outcome: "approved",
      metadata: { proposalId: id, proposalHash: hash, origin: actor.origin },
    },
  })
  try {
    const key = `focused-agent:${id}`
    let result: Record<string, unknown>
    if (fresh.action === "search") {
      const v = fresh.input as {
        type: "PEOPLE" | "LOCAL" | "COMPANY" | "DOMAIN" | "INFLUENCER"
        parameters: {
          listId: string
          duplicatePolicy: "ONLY_NEW" | "ADD_EXISTING" | "RETURN_ALL"
          [key: string]: unknown
        }
      }
      const { listId, duplicatePolicy, ...searchParams } = v.parameters
      const queued = await enqueueSearchJob({
        userId: actor.userId,
        userEmail: actor.email,
        searchType: v.type,
        listId,
        searchParams,
        duplicatePolicy,
        idempotencyKey: key,
        focusedAgentApprovalId: id,
      })
      result = {
        jobId: queued.job.id,
        searchId: queued.search.id,
        listId,
        url: `/lead-search/saved-lists/${encodeURIComponent(listId)}`,
      }
    } else {
      const v = fresh.input as {
        listId: string
        leadIds: string[]
        field?: "email" | "phone"
      }
      const eligibleIds = fresh.preview.eligibleLeadIds as string[]
      const entries = await prisma.leadListEntry.findMany({
        where: {
          listId: v.listId,
          leadId: { in: eligibleIds },
          list: { userId: actor.userId },
          lead: { userId: actor.userId },
        },
        select: { id: true },
      })
      const queued = await enqueueBulkJob({
        userId: actor.userId,
        userEmail: actor.email,
        listId: v.listId,
        entryIds: entries.map((e) => e.id),
        action:
          fresh.action === "score"
            ? "SCORE"
            : v.field === "phone"
              ? "ENRICH_PHONE"
              : "ENRICH_EMAIL",
        idempotencyKey: key,
        focusedAgentApprovalId: id,
      })
      result = {
        jobId: queued.id,
        listId: v.listId,
        url: `/lead-search/saved-lists/${encodeURIComponent(v.listId)}`,
      }
    }
    await prisma.focusedAgentApproval.update({
      where: { id },
      data: { status: "queued", result: json(result) },
    })
    return proposalView(await getProposal(actor, id))
  } catch (error) {
    await prisma.focusedAgentApproval.update({
      where: { id },
      data: {
        status: "needs_review",
        result: {
          error:
            "The approved job could not be queued reliably. Review its recorded job before trying a new approval.",
        },
      },
    })
    throw error
  }
}
