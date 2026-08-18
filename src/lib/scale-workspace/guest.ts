/**
 * Route-handler side of the team-workspace adapter: resolves the resource
 * tenant for the current request and records guest audit events.
 *
 * Personal (non-guest) requests always resolve to the signed-in user's own
 * tenant — zero behavior change when the flag is off or no guest context
 * exists. In guest context every read/write is scoped to the bound OWNER
 * tenant while the signed-in member remains the actor.
 *
 * The per-request central authorize call happens in the proxy gate
 * (src/lib/scale-workspace/gate.ts) before any handler runs; this module
 * re-verifies the local binding and session ownership.
 */

import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { isScaleTeamWorkspacesEnabled } from "./hub"
import {
  WORKSPACE_COOKIE_NAME,
  unsealWorkspaceSession,
  type SealedWorkspaceSession,
} from "./session-cookie"

type SessionLike = {
  user?: {
    id?: string
    email?: string | null
    role?: string
  } | null
} | null

export type WorkspaceScopeOk = {
  ok: true
  isGuest: boolean
  /** User.id every read/write must be scoped to (owner tenant in guest mode). */
  tenantUserId: string
  /** Email matching the tenant (owner email in guest mode) for credit calls. */
  tenantEmail: string
  /** The signed-in member — always the actor, never replaced by the owner. */
  actorUserId: string
  /** Guests never inherit local admin powers. */
  effectiveRole: string
  workspaceId: string | null
}

export type WorkspaceScopeDenied = {
  ok: false
  response: NextResponse
}

export type WorkspaceScope = WorkspaceScopeOk | WorkspaceScopeDenied

function denied(status: number, message: string, code: string): WorkspaceScopeDenied {
  return {
    ok: false,
    response: NextResponse.json({ error: message, code }, { status }),
  }
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])

async function readSealedSession(): Promise<SealedWorkspaceSession | null | "invalid"> {
  const store = await cookies()
  const raw = store.get(WORKSPACE_COOKIE_NAME)?.value
  if (!raw) return null
  const sealed = await unsealWorkspaceSession(raw)
  return sealed ?? "invalid"
}

/**
 * Resolve the tenant for the current request. Pass the request method and the
 * route template path from mutating handlers so guest audit events are
 * recorded with the actual actor.
 */
export async function resolveWorkspaceScope(
  session: SessionLike,
  request?: { method: string; path: string }
): Promise<WorkspaceScope> {
  const userId = session?.user?.id
  const email = session?.user?.email ?? ""
  const role = session?.user?.role ?? "user"
  if (!userId) {
    return denied(401, "Unauthorized", "UNAUTHORIZED")
  }

  const personal: WorkspaceScopeOk = {
    ok: true,
    isGuest: false,
    tenantUserId: userId,
    tenantEmail: email,
    actorUserId: userId,
    effectiveRole: role,
    workspaceId: null,
  }

  if (!isScaleTeamWorkspacesEnabled()) return personal

  const sealed = await readSealedSession()
  if (sealed === null) return personal
  if (sealed === "invalid") {
    return denied(
      403,
      "Workspace session is invalid. Relaunch from Scale Plus.",
      "WORKSPACE_SESSION_INVALID"
    )
  }

  // The sealed cookie must belong to THIS signed-in member.
  if (sealed.actorUserId !== userId) {
    return denied(
      403,
      "Workspace session does not match the signed-in user.",
      "WORKSPACE_ACTOR_MISMATCH"
    )
  }

  // Re-verify the persisted binding: one owner per workspace, bind-in-place.
  let ownerUserId: string | null = null
  try {
    const rows = await prisma.$queryRaw<Array<{ ownerUserId: string }>>(
      Prisma.sql`SELECT "ownerUserId" FROM "ScaleWorkspaceBinding" WHERE "workspaceId" = ${sealed.context.workspace.id} LIMIT 1`
    )
    ownerUserId = rows[0]?.ownerUserId ?? null
  } catch {
    // Table missing or database error: fail closed, never fall back to owner access.
    return denied(
      503,
      "Guest workspace binding is unavailable.",
      "WORKSPACE_BINDING_UNAVAILABLE"
    )
  }
  if (!ownerUserId || ownerUserId !== sealed.ownerUserId) {
    return denied(
      403,
      "Guest workspace binding is missing or has changed.",
      "WORKSPACE_BINDING_MISSING"
    )
  }

  if (request && MUTATING_METHODS.has(request.method.toUpperCase())) {
    recordWorkspaceAuditEvent(sealed, request.method, request.path)
  }

  return {
    ok: true,
    isGuest: true,
    tenantUserId: ownerUserId,
    tenantEmail: sealed.context.owner.email,
    actorUserId: userId,
    effectiveRole: "user",
    workspaceId: sealed.context.workspace.id,
  }
}

/**
 * Fire-and-forget audit record of the actual actor (member), separate from
 * the owner-scoped resource rows. Never throws into the request path.
 */
function recordWorkspaceAuditEvent(
  sealed: SealedWorkspaceSession,
  method: string,
  path: string
): void {
  void prisma
    .$executeRaw(
      Prisma.sql`INSERT INTO "ScaleWorkspaceAuditEvent"
        ("id", "workspaceId", "actorUserId", "ownerUserId", "actorKeycloakSubject", "method", "path")
        VALUES (gen_random_uuid()::text, ${sealed.context.workspace.id}, ${sealed.actorUserId},
                ${sealed.ownerUserId}, ${sealed.actorKeycloakSubject},
                ${method.toUpperCase().slice(0, 10)}, ${path.slice(0, 2000)})`
    )
    .catch(() => undefined)
}
