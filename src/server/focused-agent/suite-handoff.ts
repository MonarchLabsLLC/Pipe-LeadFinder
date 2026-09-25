/**
 * The Agent's side of the one-click handoff (src/lib/suite-link/handoff.ts):
 * the same signed calls to PipeLeads CRM and MailBaser, made for a verified
 * Agent actor instead of the browser session. Reads the destination pickers
 * (options) and, only after a person approves a proposal, sends the leads.
 */
import { randomUUID } from "node:crypto"
import { prisma } from "@/lib/prisma"
import { postSigned, HandoffError } from "@/lib/suite-link/client"
import { getHandoffTarget, type HandoffTargetName } from "@/lib/suite-link/config"
import { RECEIVER_PATHS, sendHandoff } from "@/lib/suite-link/handoff"
import type { WorkspaceScopeOk } from "@/lib/scale-workspace/guest"
import { FocusedAgentError } from "./security"
import type { AgentActor } from "./access"

export type HandoffTargetKey = HandoffTargetName

export type HandoffOptions = {
  workspaceName?: string
  pipelines?: { id: string; name: string; stages: { id: string; name: string; kind?: string }[] }[]
  lists?: { id: string; name: string }[]
  tags?: { id: string; name: string }[]
}

export const handoffTargetLabel = (target: HandoffTargetKey) =>
  target === "pipeleads" ? "PipeLeads CRM" : "MailBaser"

async function ready(a: AgentActor, name: HandoffTargetKey) {
  const target = getHandoffTarget(name)
  if (!target)
    throw new FocusedAgentError(
      "HANDOFF_NOT_CONFIGURED",
      `${handoffTargetLabel(name)} is not connected to Lead Finder yet.`,
      503
    )
  const user = await prisma.user.findUnique({
    where: { id: a.userId },
    select: { email: true, name: true, keycloakSubId: true },
  })
  const subject = user?.keycloakSubId?.trim()
  if (!user || !subject)
    throw new FocusedAgentError(
      "KEYCLOAK_SUBJECT_REQUIRED",
      `Your account is not linked to a Scale Plus sign-in yet, so it cannot be matched in ${handoffTargetLabel(name)}.`,
      409
    )
  // The Agent always acts for the workspace owner (never a guest).
  const scope: WorkspaceScopeOk = {
    ok: true,
    isGuest: false,
    tenantUserId: a.userId,
    tenantEmail: a.email,
    actorUserId: a.userId,
    effectiveRole: "owner",
    workspaceId: null,
  }
  return {
    ok: true as const,
    target,
    scope,
    identity: {
      subject,
      email: user.email.trim().toLowerCase(),
      ...(user.name?.trim() ? { name: user.name.trim() } : {}),
    },
  }
}

function asAgentError(error: unknown, name: HandoffTargetKey): never {
  if (error instanceof FocusedAgentError) throw error
  if (error instanceof HandoffError)
    throw new FocusedAgentError(
      "HANDOFF_UNAVAILABLE",
      error.message || `${handoffTargetLabel(name)} is unavailable.`,
      error.status === 409 ? 409 : 502
    )
  throw new FocusedAgentError(
    "HANDOFF_UNAVAILABLE",
    `${handoffTargetLabel(name)} is unavailable right now.`,
    502
  )
}

/** Read-only: pipelines and stages (PipeLeads) or lists and tags (MailBaser). */
export async function loadHandoffOptions(
  a: AgentActor,
  name: HandoffTargetKey
): Promise<HandoffOptions> {
  const r = await ready(a, name)
  try {
    return await postSigned<HandoffOptions>(r.target, RECEIVER_PATHS[name].options, {
      ...r.identity,
      requestId: randomUUID(),
    })
  } catch (error) {
    asAgentError(error, name)
  }
}

/** Only called by an approved proposal. */
export async function sendHandoffForActor(
  a: AgentActor,
  name: HandoffTargetKey,
  body: Record<string, unknown>
) {
  const r = await ready(a, name)
  const response = await sendHandoff(r, body)
  const data = (await response.json().catch(() => null)) as {
    counts?: Record<string, number>
    openUrl?: string
    error?: string
  } | null
  if (!response.ok || !data?.counts)
    throw new FocusedAgentError(
      "HANDOFF_FAILED",
      data?.error || `${handoffTargetLabel(name)} did not accept these leads.`,
      response.status >= 400 && response.status < 600 ? response.status : 502
    )
  return { counts: data.counts, openUrl: data.openUrl ?? null }
}
