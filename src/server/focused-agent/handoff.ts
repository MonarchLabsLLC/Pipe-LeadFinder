import { z } from "zod"
import { prisma } from "@/lib/prisma"
import type { AgentActor } from "./access"
import { assertWrites } from "./access"
import { id, leadSelectionSchema, selectedLeads, leadView, json } from "./resources"
import { FocusedAgentError, hashCanonical, signFocusedRequest, trustedServiceUrl } from "./security"

export const handoffDestinationSchema = z.object({ destinationWorkspaceId: id.optional(), query: z.string().max(200).optional() }).strict()
export const handoffPrepareSchema = leadSelectionSchema.extend({ destinationWorkspaceId: id, pipelineId: id, stageId: id, createDeals: z.boolean().default(true) }).strict()
export const handoffEnabled = () => process.env.LEADFINDER_AGENT_HANDOFF_ENABLED === "true"
function enabled() {
  if (!handoffEnabled()) throw new FocusedAgentError("HANDOFF_DISABLED", "CRM transfers are not enabled.", 503)
}
/** Available only to the authenticated bridge, never model-supplied record data. */
export async function exportTransfer(a: AgentActor, raw: unknown) {
  enabled()
  const input = leadSelectionSchema.parse(raw)
  const { list, entries } = await selectedLeads(a, input.listId, input.leadIds)
  const snapshot = { sourceApp: "leadfinder", sourceWorkspaceId: a.workspaceId, listId: list.id,
    listVersion: list.updatedAt.toISOString(), records: entries.map(e => leadView(e.lead, list.id)) }
  return { snapshot, sourceHash: hashCanonical(snapshot) }
}
async function bridge(a: AgentActor, action: "destinations" | "prepare" | "status", input: unknown, key: string) {
  enabled()
  const path = `/api/internal/godmode/handoff/leadfinder/${action}`
  const body = { protocolVersion: "1", subject: a.subject, requestId: key, input }
  const token = await signFocusedRequest({ secret: process.env.LEADFINDER_GODMODE_SERVICE_SECRET!,
    issuer: "leadfinder-godmode-service", audience: "clickcampaigns-godmode-handoff", subject: a.subject,
    action: `handoff:${action}`, path, body })
  const response = await fetch(trustedServiceUrl(process.env.CLICKCAMPAIGNS_GODMODE_BASE_URL, path), {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(30000),
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
  })
  const result = await response.json()
  if (!response.ok || result.protocolVersion !== "1") throw new FocusedAgentError(result.error?.code || "HANDOFF_UNAVAILABLE", result.error?.message || "CRM transfer is unavailable.", response.status || 503)
  return result.data
}
export async function crmDestinations(a: AgentActor, raw: unknown, key: string) {
  return bridge(a, "destinations", handoffDestinationSchema.parse(raw), key)
}
export async function prepareCrmTransfer(a: AgentActor, raw: unknown, key: string) {
  assertWrites()
  const input = handoffPrepareSchema.parse(raw)
  // Ownership is checked here and checked again by the bridge's source export.
  await selectedLeads(a, input.listId, input.leadIds)
  const proposal = await bridge(a, "prepare", { ...input, sourceWorkspaceId: a.workspaceId }, key)
  const safe = z.object({ id: z.string().uuid(), proposalHash: z.string().regex(/^[a-f0-9]{64}$/), approvalUrl: z.string().url(), status: z.string() }).passthrough().parse(proposal)
  await prisma.focusedAgentAudit.create({ data: { userId: a.userId, workspaceId: a.workspaceId,
    action: "crm_transfer", outcome: "prepared", metadata: json({ proposalId: safe.id, listId: input.listId, approvalUrl: safe.approvalUrl }) } })
  return safe
}
export async function crmTransferStatus(a: AgentActor, proposalId: string, key: string) {
  return bridge(a, "status", { proposalId: z.string().uuid().parse(proposalId) }, key)
}
