/**
 * Server-only. The route-handler side of the one-click handoff: who may send,
 * which leads they may send, and turning receiver answers into our responses.
 *
 * Route files under src/app/api/handoff/ stay thin and call into this module.
 */

import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { resolveWorkspaceScope, type WorkspaceScopeOk } from "@/lib/scale-workspace/guest"
import { HandoffError, postSigned } from "./client"
import { contactsUrl, getHandoffTarget, type HandoffTarget, type HandoffTargetName } from "./config"
import {
  HANDOFF_LEAD_SELECT,
  MAX_LEADS_PER_SEND,
  toMailbaserContact,
  toSuiteLead,
  type HandoffLeadRow,
} from "./payload"

export type HandoffIdentity = { subject: string; email: string; name?: string }

export type HandoffStatus = "created" | "updated" | "skipped"

export type HandoffResult = {
  externalId: string
  status: HandoffStatus
  contactId?: string | null
  url?: string | null
  reason?: string
}

export type HandoffSendResponse = {
  results: HandoffResult[]
  counts: Record<HandoffStatus, number>
  openUrl: string
}

export const RECEIVER_PATHS = {
  pipeleads: {
    options: "/api/internal/leadfinder/options",
    send: "/api/internal/leadfinder/leads",
  },
  mailbaser: {
    options: "/api/internal/scaleplus/leadfinder/options",
    send: "/api/internal/scaleplus/leadfinder/contacts",
  },
} as const

function fail(status: number, error: string, code: string) {
  return NextResponse.json({ error, code }, { status })
}

type Ready = {
  ok: true
  target: HandoffTarget
  scope: WorkspaceScopeOk
  identity: HandoffIdentity
}

/**
 * Target enabled -> signed in -> tenant scope -> owner only -> Keycloak
 * identity. Anything short of that answers with the matching error response.
 */
export async function prepareHandoff(
  name: HandoffTargetName,
  request: { method: string; path: string }
): Promise<Ready | { ok: false; response: NextResponse }> {
  const target = getHandoffTarget(name)
  if (!target) return { ok: false, response: fail(404, "Not found", "not_found") }

  const session = await auth()
  if (!session?.user?.id) {
    return { ok: false, response: fail(401, "Unauthorized", "UNAUTHORIZED") }
  }
  const scope = await resolveWorkspaceScope(session, request)
  if (!scope.ok) return { ok: false, response: scope.response }

  // Handoff sends the owner's prospects into the owner's own CRM or mail
  // account under the owner's identity. Like the webhook integrations it is
  // an owner-only action, never available inside a guest workspace.
  if (scope.isGuest) {
    return {
      ok: false,
      response: fail(
        403,
        `Only the workspace owner can send leads to ${target.label}.`,
        "WORKSPACE_OWNER_ONLY"
      ),
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: scope.actorUserId },
    select: { email: true, name: true, keycloakSubId: true },
  })
  const subject = user?.keycloakSubId?.trim()
  if (!user || !subject) {
    return {
      ok: false,
      response: fail(
        409,
        `Your account is not linked to a Scale Plus sign-in yet, so it cannot be matched in ${target.label}. Sign out and sign in again through Scale Plus, then retry.`,
        "keycloak_subject_required"
      ),
    }
  }

  return {
    ok: true,
    target,
    scope,
    identity: {
      subject,
      email: user.email.trim().toLowerCase(),
      ...(user.name?.trim() ? { name: user.name.trim() } : {}),
    },
  }
}

/** Turn a receiver failure into our response, keeping its message. */
export function handoffErrorResponse(error: unknown, target: HandoffTarget): NextResponse {
  if (error instanceof HandoffError) {
    if (error.status === 409) return fail(409, error.message, error.code)
    if (error.code === "timeout") return fail(504, error.message, error.code)
    if (error.status === 401 || error.status === 404) {
      return fail(
        502,
        `${target.label} did not accept the connection from Lead Finder. The handoff is not fully set up yet.`,
        error.code
      )
    }
    return fail(502, error.message, error.code)
  }
  console.error(`[handoff:${target.name}]`, error)
  return fail(500, `Leads could not be sent to ${target.label}. Try again.`, "internal_error")
}

// ── Options ──────────────────────────────────────────────────────────────

export async function fetchOptions(ready: Ready): Promise<NextResponse> {
  try {
    const data = await postSigned<Record<string, unknown>>(
      ready.target,
      RECEIVER_PATHS[ready.target.name].options,
      { ...ready.identity, requestId: randomUUID() }
    )
    return NextResponse.json(data, { headers: { "cache-control": "no-store" } })
  } catch (error) {
    return handoffErrorResponse(error, ready.target)
  }
}

// ── Send ─────────────────────────────────────────────────────────────────

const id = z.string().trim().min(1).max(200)
const leadIds = z.array(id).min(1).max(MAX_LEADS_PER_SEND)
// The Suite accepts at most 20 tag names of 50 characters.
const tagNames = z.array(z.string().trim().min(1).max(50)).max(20)

export const pipeleadsSendSchema = z
  .object({
    leadIds,
    createDeals: z.boolean().optional(),
    pipelineId: id.optional(),
    stageId: id.optional(),
    tagNames: tagNames.optional(),
  })
  .strict()

export const mailbaserSendSchema = z
  .object({
    leadIds,
    listIds: z.array(id).max(50).optional(),
    tagIds: z.array(id).max(50).optional(),
    tagNames: tagNames.optional(),
  })
  .strict()

type LoadedLead = HandoffLeadRow & { listEntries: { list: { name: string } }[] }

/** Leads the tenant owns, through their own lists. Unknown ids simply do not come back. */
export async function loadScopedLeads(tenantUserId: string, ids: string[]): Promise<LoadedLead[]> {
  return prisma.lead.findMany({
    where: {
      id: { in: ids },
      listEntries: { some: { list: { userId: tenantUserId } } },
    },
    select: {
      ...HANDOFF_LEAD_SELECT,
      listEntries: {
        where: { list: { userId: tenantUserId } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { list: { select: { name: true } } },
      },
    },
  }) as Promise<LoadedLead[]>
}

export function countResults(results: HandoffResult[]): Record<HandoffStatus, number> {
  const counts = { created: 0, updated: 0, skipped: 0 }
  for (const result of results) counts[result.status] += 1
  return counts
}

function sanitizeResults(value: unknown): HandoffResult[] {
  const list = (value as { results?: unknown })?.results
  if (!Array.isArray(list)) {
    throw new HandoffError("bad_response", 200, "The receiver sent an unreadable response.")
  }
  return list.flatMap((item): HandoffResult[] => {
    if (!item || typeof item !== "object") return []
    const record = item as Record<string, unknown>
    if (typeof record.externalId !== "string") return []
    const status: HandoffStatus =
      record.status === "created" || record.status === "updated" ? record.status : "skipped"
    return [
      {
        externalId: record.externalId,
        status,
        contactId: typeof record.contactId === "string" ? record.contactId : null,
        url: typeof record.url === "string" ? record.url : null,
        ...(typeof record.reason === "string" ? { reason: record.reason } : {}),
      },
    ]
  })
}

/** Results in the order the ids were asked for; any id with no answer is skipped. */
function assemble(ids: string[], local: HandoffResult[], remote: HandoffResult[]): HandoffResult[] {
  const byId = new Map<string, HandoffResult>()
  for (const result of [...local, ...remote]) byId.set(result.externalId, result)
  return ids.map(
    (externalId) =>
      byId.get(externalId) ?? { externalId, status: "skipped", contactId: null, reason: "no_result" }
  )
}

export async function sendHandoff(ready: Ready, body: unknown): Promise<NextResponse> {
  const { target, scope, identity } = ready
  const schema = target.name === "pipeleads" ? pipeleadsSendSchema : mailbaserSendSchema
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    const tooMany = parsed.error.issues.some(
      (issue) => issue.path[0] === "leadIds" && issue.code === "too_big"
    )
    return NextResponse.json(
      {
        error: tooMany
          ? `Send at most ${MAX_LEADS_PER_SEND} leads at a time.`
          : "Invalid request",
        code: tooMany ? "too_many_leads" : "invalid_request",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    )
  }

  const ids = [...new Set(parsed.data.leadIds)]
  const leads = await loadScopedLeads(scope.tenantUserId, ids)
  const found = new Set(leads.map((lead) => lead.id))
  const local: HandoffResult[] = ids
    .filter((leadId) => !found.has(leadId))
    .map((externalId) => ({ externalId, status: "skipped", contactId: null, reason: "not_found" }))

  const requestId = randomUUID()
  let remote: HandoffResult[] = []

  try {
    if (target.name === "pipeleads") {
      const data = parsed.data as z.infer<typeof pipeleadsSendSchema>
      const createDeals = data.createDeals === true
      if (leads.length > 0) {
        remote = sanitizeResults(
          await postSigned(target, RECEIVER_PATHS.pipeleads.send, {
            ...identity,
            requestId,
            leads: leads.map((lead) => toSuiteLead(lead, lead.listEntries[0]?.list.name)),
            createDeals,
            ...(createDeals && data.pipelineId ? { pipelineId: data.pipelineId } : {}),
            ...(createDeals && data.stageId ? { stageId: data.stageId } : {}),
            ...(data.tagNames?.length ? { tagNames: data.tagNames } : {}),
          })
        )
      }
    } else {
      const data = parsed.data as z.infer<typeof mailbaserSendSchema>
      const contacts = []
      for (const lead of leads) {
        const contact = toMailbaserContact(lead)
        if (contact) contacts.push(contact)
        else local.push({ externalId: lead.id, status: "skipped", contactId: null, reason: "no_email" })
      }
      if (contacts.length > 0) {
        remote = sanitizeResults(
          await postSigned(target, RECEIVER_PATHS.mailbaser.send, {
            ...identity,
            requestId,
            contacts,
            ...(data.listIds?.length ? { listIds: data.listIds } : {}),
            ...(data.tagIds?.length ? { tagIds: data.tagIds } : {}),
            ...(data.tagNames?.length ? { tagNames: data.tagNames } : {}),
          })
        )
      }
    }
  } catch (error) {
    return handoffErrorResponse(error, target)
  }

  const results = assemble(ids, local, remote)
  const payload: HandoffSendResponse = {
    results,
    counts: countResults(results),
    openUrl: contactsUrl(target),
  }
  return NextResponse.json(payload)
}
