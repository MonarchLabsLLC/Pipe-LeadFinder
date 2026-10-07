import { randomUUID } from "node:crypto"

import { prisma } from "@/lib/prisma"
import type { FocusedAgentApproval, PluginProposal } from "@/generated/prisma/client"
import type { AgentActor } from "@/server/focused-agent/access"
import { buildPlan, type Plan, type PlanAction } from "@/server/focused-agent/plans"
import { EXTRA_PLAN_ACTIONS, executeExtraPlan, type ExtraPlanAction } from "@/server/focused-agent/plans-extra"
import { requireCredits } from "@/server/focused-agent/pricing"
import { proposalHash } from "@/server/focused-agent/proposals"
import { json } from "@/server/focused-agent/resources"
import { FocusedAgentError, exactHash, hashCanonical } from "@/server/focused-agent/security"
import { bulkEnrichSelection, rerunSearchInput } from "@/server/focused-agent/tools"
import { enqueueBulkJob } from "@/services/bulk-job"
import { enqueueSearchJob } from "@/services/search-job"

import { PLUGIN_PROPOSAL_TTL_MS, PluginError, pluginProposalStatus, type PluginActor, type PluginOwnerAccount } from "./contract"
import { pluginsEnabled } from "./env"
import { queuePluginActionOutcome, queuePluginEvent } from "./events"
import { pluginActionNamed, type PluginAction } from "./registry"
import type { ChangeMode, ChangeOutcome, PluginCall, ProposalStatusRow } from "./service"

// Everything a plugin changes in Lead Finder goes through here.
//
// It reuses the Lead Finder Agent's parts: the priced plan and preview
// (plans.ts buildPlan), the hashed proposal row (FocusedAgentApproval, with
// origin "plugin") and the same background jobs the app's own screens start
// (search-job.ts, bulk-job.ts), which check and charge the owner's Scale
// Credits the usual way.
//
// What it does NOT reuse is the Agent's gate: a plugin needs neither Pro Max
// nor the LEADFINDER_AGENT_* switches. Its gate is SCALE_PLUGINS_ENABLED, the
// install's scopes and the owner's own approval (or their act_unattended grant).

const isExtra = (action: string): action is ExtraPlanAction => (EXTRA_PLAN_ACTIONS as readonly string[]).includes(action)

/** The owner, in the shape the Agent's tools expect. "mcp": links are absolute, for a caller outside the app. */
export function ownerActor(owner: PluginOwnerAccount): AgentActor {
  return { userId: owner.userId, workspaceId: owner.userId, subject: owner.subject, email: owner.email, origin: "mcp" }
}

/** The preview the owner approves, named after the plugin that asked. */
export function labelPreview(preview: Record<string, unknown>, actor: PluginActor): Record<string, unknown> {
  return {
    ...preview,
    title: `${actor.pluginName}: ${String(preview.title ?? "Change")}`,
    requestedBy: { kind: "plugin", pluginName: actor.pluginName, pluginId: actor.pluginId, installId: actor.installId },
  }
}

const maximumCredits = (plan: Pick<Plan, "preview">) => (plan.preview.cost as { maximumCredits?: number } | undefined)?.maximumCredits ?? 0

// ---------------------------------------------------------------------------
// Running an approved (or unattended) plan
// ---------------------------------------------------------------------------

/** Start the work. Searches, enrichment and scoring become the product's normal background jobs. */
async function execute(a: AgentActor, id: string, plan: Plan): Promise<Record<string, unknown>> {
  const key = `plugin:${id}`
  if (isExtra(plan.action)) {
    return executeExtraPlan(a, plan as Parameters<typeof executeExtraPlan>[1], id)
  }
  if (plan.action === "search") {
    const v = plan.input as {
      type: "PEOPLE" | "LOCAL" | "COMPANY" | "DOMAIN" | "INFLUENCER"
      parameters: { listId?: string; duplicatePolicy: "ONLY_NEW" | "ADD_EXISTING" | "RETURN_ALL"; [key: string]: unknown }
      newList?: { name: string }
    }
    const { listId: existingListId, duplicatePolicy, ...searchParams } = v.parameters
    let listId = existingListId ?? ""
    if (v.newList) {
      const created = await prisma.leadList.create({ data: { userId: a.userId, name: v.newList.name, type: v.type } })
      listId = created.id
      await prisma.focusedAgentApproval.update({ where: { id }, data: { result: json({ listId, createdList: true }) } })
    }
    const queued = await enqueueSearchJob({ userId: a.userId, userEmail: a.email, searchType: v.type, listId, searchParams, duplicatePolicy, idempotencyKey: key })
    return { runId: queued.job.id, searchId: queued.search.id, listId, ...(v.newList ? { createdList: true } : {}) }
  }
  const v = plan.input as { listId: string; field?: "email" | "phone" }
  const eligibleIds = plan.preview.eligibleLeadIds as string[]
  const entries = await prisma.leadListEntry.findMany({
    where: { listId: v.listId, leadId: { in: eligibleIds }, list: { userId: a.userId }, lead: { userId: a.userId } },
    select: { id: true },
  })
  const queued = await enqueueBulkJob({
    userId: a.userId,
    userEmail: a.email,
    listId: v.listId,
    entryIds: entries.map((entry) => entry.id),
    action: plan.action === "score" ? "SCORE" : v.field === "phone" ? "ENRICH_PHONE" : "ENRICH_EMAIL",
    idempotencyKey: key,
  })
  return { runId: queued.id, listId: v.listId, leads: entries.length }
}

type Started = { started: true; status: "queued" | "completed"; result: Record<string, unknown> } | { started: false }

/** Claim the pending row once, then run it. A second claim is a no-op. */
async function startApproved(a: AgentActor, id: string, plan: Plan, method: "plugin-owner" | "plugin-unattended", now: Date): Promise<Started> {
  const claimed = await prisma.focusedAgentApproval.updateMany({
    where: { id, userId: a.userId, origin: "plugin", status: "pending", expiresAt: { gt: now } },
    data: { status: "approved", approvedAt: now, approvalMethod: method },
  })
  if (!claimed.count) return { started: false }
  try {
    const result = await execute(a, id, plan)
    const status = isExtra(plan.action) ? "completed" : "queued"
    await prisma.focusedAgentApproval.update({ where: { id }, data: { status, result: json(result) } })
    return { started: true, status, result }
  } catch (error) {
    await prisma.focusedAgentApproval.update({
      where: { id },
      data: { status: "needs_review", result: { error: "The work could not be started. Nothing will be retried automatically." } },
    })
    throw error
  }
}

// ---------------------------------------------------------------------------
// A plugin asks (POST /actions/:action for a write or act action)
// ---------------------------------------------------------------------------

export async function runPluginChange(
  call: PluginCall,
  action: PluginAction,
  input: Record<string, unknown>,
  options: { mode: ChangeMode; idempotencyKey: string }
): Promise<ChangeOutcome> {
  if (action.run.kind !== "plan") throw new PluginError("app_error", "This action cannot change anything.")
  const a = ownerActor(call.owner)
  const raw = action.run.via === "rerun" ? await rerunSearchInput(a, input) : action.run.via === "bulk-enrich" ? await bulkEnrichSelection(a, input) : input
  // Ownership, eligibility and the current price, exactly as the Agent checks them.
  const plan = await buildPlan(a, action.run.plan, raw)

  if (options.mode === "direct") {
    if (!isExtra(plan.action)) throw new PluginError("app_error", "This action needs the owner's approval.")
    const result = await executeExtraPlan(a, plan as Parameters<typeof executeExtraPlan>[1], call.requestId)
    if (plan.action === "label" && typeof result.listId === "string") {
      await queuePluginEvent(a.userId, { type: "leadfinder.list.updated", data: { listId: result.listId, reason: "labels_changed", count: Number(result.changed ?? 0) } })
    }
    return { kind: "done", data: result }
  }

  // Credits are checked before anything is stored or started, attended or not.
  await requireCredits(a, maximumCredits(plan))

  const key = `plugin:${call.actor.installId}:${options.idempotencyKey}`.slice(0, 600)
  const where = { userId_workspaceId_idempotencyKey: { userId: a.userId, workspaceId: a.workspaceId, idempotencyKey: key } }
  let row = await prisma.focusedAgentApproval.findUnique({ where })
  if (row) {
    if (row.origin !== "plugin" || row.action !== plan.action || hashCanonical(row.input) !== hashCanonical(plan.input)) {
      throw new PluginError("invalid_input", "This idempotency key was already used for a different request.")
    }
  } else {
    const data = {
      id: randomUUID(),
      userId: a.userId,
      workspaceId: a.workspaceId,
      subject: a.subject,
      origin: "plugin",
      action: plan.action,
      input: json(plan.input),
      preview: json(labelPreview(plan.preview, call.actor)),
      versions: json(plan.versions),
      expiresAt: new Date(call.now.getTime() + PLUGIN_PROPOSAL_TTL_MS),
      idempotencyKey: key,
    }
    const created = await prisma.$transaction([
      prisma.focusedAgentApproval.create({ data: { ...data, proposalHash: proposalHash(data) } }),
      prisma.pluginProposal.create({
        data: {
          approvalId: data.id,
          userId: a.userId,
          ownerSubject: a.subject,
          installId: call.actor.installId,
          pluginId: call.actor.pluginId,
          pluginName: call.actor.pluginName,
          actionName: action.name,
          area: action.area,
          unattended: options.mode === "unattended",
        },
      }),
    ])
    row = created[0]
  }

  if (row.status === "pending" && options.mode === "unattended") {
    const started = await startApproved(a, row.id, plan, "plugin-unattended", call.now)
    if (started.started) return { kind: "done", proposalId: row.id, data: { proposalId: row.id, status: started.status, ...started.result } }
    row = await prisma.focusedAgentApproval.findUniqueOrThrow({ where: { id: row.id } })
  }
  if (row.status === "pending") return { kind: "pending", proposalId: row.id, expiresAt: row.expiresAt.toISOString() }
  // The same idempotency key again, after the work was started or decided.
  return { kind: "done", proposalId: row.id, data: { proposalId: row.id, status: row.status, ...((row.result as Record<string, unknown> | null) ?? {}) } }
}

// ---------------------------------------------------------------------------
// Outcomes: the owner decides, or 72 hours pass
// ---------------------------------------------------------------------------

async function recordOutcome(meta: PluginProposal, outcome: "approved" | "rejected" | "expired", extra: { status?: "executed" | "failed"; result?: unknown } = {}) {
  await queuePluginActionOutcome(meta.userId, outcome, { proposalId: meta.approvalId, installId: meta.installId, ...extra })
  try {
    await prisma.pluginProposal.update({ where: { approvalId: meta.approvalId }, data: { outcome, outcomeAt: new Date() } })
  } catch (error) {
    console.error("[plugins] could not record a proposal outcome", error instanceof Error ? error.message : error)
  }
}

async function expire(row: FocusedAgentApproval, meta: PluginProposal): Promise<boolean> {
  const changed = await prisma.focusedAgentApproval.updateMany({ where: { id: row.id, origin: "plugin", status: "pending" }, data: { status: "expired" } })
  if (changed.count) await recordOutcome(meta, "expired")
  return changed.count > 0
}

/** Expire every plugin proposal past its 72 hours and report each one. Returns how many. */
export async function expirePluginProposals(now: Date, limit = 100): Promise<number> {
  const due = await prisma.focusedAgentApproval.findMany({
    where: { origin: "plugin", status: "pending", expiresAt: { lte: now } },
    orderBy: { expiresAt: "asc" },
    take: limit,
  })
  let expired = 0
  for (const row of due) {
    const meta = await prisma.pluginProposal.findUnique({ where: { approvalId: row.id } })
    if (meta && (await expire(row, meta))) expired += 1
  }
  return expired
}

export interface PluginProposalView {
  id: string
  pluginName: string
  actionName: string
  actionTitle: string
  title: string
  status: string
  cost: unknown
  effects: string[]
  list: unknown
  createdAt: string
  expiresAt: string
  result: unknown
}

function view(row: FocusedAgentApproval, meta: PluginProposal): PluginProposalView {
  const preview = (row.preview ?? {}) as Record<string, unknown>
  return {
    id: row.id,
    pluginName: meta.pluginName,
    actionName: meta.actionName,
    actionTitle: pluginActionNamed(meta.actionName)?.title ?? meta.actionName,
    title: String(preview.title ?? meta.actionName),
    status: row.status,
    cost: preview.cost ?? null,
    effects: Array.isArray(preview.effects) ? (preview.effects as unknown[]).map(String) : [],
    list: preview.list ?? null,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    result: row.result,
  }
}

async function load(userId: string, id: string) {
  const [row, meta] = await Promise.all([
    prisma.focusedAgentApproval.findFirst({ where: { id, userId, origin: "plugin" } }),
    prisma.pluginProposal.findFirst({ where: { approvalId: id, userId } }),
  ])
  if (!row || !meta) throw new FocusedAgentError("PROPOSAL_NOT_FOUND", "This proposal is not available.", 404)
  return { row, meta }
}

/** What plugins are waiting for the owner to decide, newest first. */
export async function pendingPluginProposals(userId: string, now = new Date()): Promise<PluginProposalView[]> {
  const metas = await prisma.pluginProposal.findMany({ where: { userId, outcome: null, unattended: false }, orderBy: { createdAt: "desc" }, take: 50 })
  if (!metas.length) return []
  const rows = await prisma.focusedAgentApproval.findMany({
    where: { id: { in: metas.map((meta) => meta.approvalId) }, userId, origin: "plugin", status: "pending", expiresAt: { gt: now } },
  })
  const byId = new Map(rows.map((row) => [row.id, row]))
  return metas.flatMap((meta) => {
    const row = byId.get(meta.approvalId)
    return row ? [view(row, meta)] : []
  })
}

/**
 * The owner approves or rejects a plugin's proposal. Called from the Plugins
 * page and, for the same rows, from the Agent panel's approval card
 * (focused-agent/proposals.ts hands origin "plugin" proposals here).
 *
 * Approve re-prices and re-checks the plan first. If records or prices changed
 * since the plugin asked, nothing runs and the proposal is reported as failed.
 * Not enough credits is an error to the owner and leaves the proposal pending.
 */
export async function decidePluginProposal(input: { userId: string; id: string; decision: "approve" | "reject"; now?: Date }): Promise<PluginProposalView> {
  if (!pluginsEnabled()) throw new FocusedAgentError("SERVICE_DISABLED", "Plugins are not enabled.", 503)
  const now = input.now ?? new Date()
  const { row, meta } = await load(input.userId, input.id)
  const reload = async () => view(await prisma.focusedAgentApproval.findUniqueOrThrow({ where: { id: row.id } }), meta)

  if (row.status !== "pending") return view(row, meta)
  if (row.expiresAt <= now) {
    await expire(row, meta)
    return reload()
  }
  if (input.decision === "reject") {
    const changed = await prisma.focusedAgentApproval.updateMany({ where: { id: row.id, status: "pending" }, data: { status: "rejected" } })
    if (changed.count) await recordOutcome(meta, "rejected")
    return reload()
  }

  const user = await prisma.user.findUnique({ where: { id: input.userId } })
  if (!user) throw new FocusedAgentError("PROPOSAL_NOT_FOUND", "This proposal is not available.", 404)
  const a = ownerActor({ userId: user.id, email: user.email, subject: row.subject })
  const actor: PluginActor = { pluginId: meta.pluginId, installId: meta.installId, pluginName: meta.pluginName }

  if (!exactHash(row.proposalHash, proposalHash(row))) {
    throw new FocusedAgentError("PROPOSAL_INTEGRITY_ERROR", "The preview was changed after the plugin asked.", 409)
  }

  const stale = async (reason: string) => {
    const error = `${reason} Nothing was started and nothing was charged.`
    const changed = await prisma.focusedAgentApproval.updateMany({ where: { id: row.id, status: "pending" }, data: { status: "stale", result: { error } } })
    if (changed.count) await recordOutcome(meta, "approved", { status: "failed", result: { error } })
    return reload()
  }

  let fresh: Plan
  try {
    fresh = await buildPlan(a, row.action as PlanAction, row.input)
  } catch (error) {
    // A list, lead or label it named is gone or no longer eligible.
    if (error instanceof FocusedAgentError && error.status < 500) return stale(error.message)
    throw error
  }
  if (hashCanonical(fresh.versions) !== hashCanonical(row.versions) || hashCanonical(labelPreview(fresh.preview, actor)) !== hashCanonical(row.preview)) {
    return stale("Records or prices changed after the plugin asked.")
  }
  await requireCredits(a, maximumCredits(fresh))

  try {
    const started = await startApproved(a, row.id, fresh, "plugin-owner", now)
    if (started.started) await recordOutcome(meta, "approved", { status: "executed", result: { status: started.status, ...started.result } })
  } catch (error) {
    console.error("[plugins] an approved proposal could not be started", error instanceof Error ? error.message : error)
    await recordOutcome(meta, "approved", { status: "failed", result: { error: "The work could not be started. Nothing will be retried automatically." } })
  }
  return reload()
}

/** GET /proposals/:id: only for the install that filed it, in the owner's account. */
export async function proposalForInstall(input: { id: string; installId: string; userId: string; now: Date }): Promise<ProposalStatusRow | null> {
  const meta = await prisma.pluginProposal.findFirst({ where: { approvalId: input.id, installId: input.installId, userId: input.userId } })
  if (!meta) return null
  let row = await prisma.focusedAgentApproval.findFirst({ where: { id: input.id, userId: input.userId, origin: "plugin" } })
  if (!row) return null
  if (row.status === "pending" && row.expiresAt <= input.now) {
    await expire(row, meta)
    row = await prisma.focusedAgentApproval.findUniqueOrThrow({ where: { id: row.id } })
  }
  const result = (row.result as Record<string, unknown> | null) ?? null
  const job =
    typeof result?.runId === "string" ? await prisma.jobRun.findFirst({ where: { id: result.runId, userId: input.userId }, select: { status: true, stage: true, errorMessage: true } }) : null
  return {
    proposalId: row.id,
    status: pluginProposalStatus(row.status, { jobFailed: job?.status === "FAILED" }),
    ...(result || job
      ? { result: { ...(result ?? {}), ...(job ? { run: { status: job.status.toLowerCase(), stage: job.stage, ...(job.errorMessage ? { error: job.errorMessage } : {}) } } : {}) } }
      : {}),
  }
}
