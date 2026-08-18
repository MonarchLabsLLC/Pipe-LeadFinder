/**
 * Guest workspace gate, invoked from src/proxy.ts for every /api request.
 *
 * When SCALE_TEAM_WORKSPACES_ENABLED is not "true" or no sealed workspace
 * cookie is present, this returns null immediately — the personal owner path
 * is completely untouched.
 *
 * For guest requests it fails closed:
 *  - sensitive paths          -> 403
 *  - unclassified paths       -> 403
 *  - missing Keycloak bearer  -> 401
 *  - central authorize non-OK -> 409 + guest context cleared
 *  - hub timeout / error      -> 503 (context kept; retry allowed)
 *
 * No database access here — tenant resolution and audit happen in
 * resolveWorkspaceScope inside the allowlisted route handlers.
 */

import { NextResponse, type NextRequest } from "next/server"
import {
  SCALE_WORKSPACE_APP_SLUG,
  isGeneralMemberWorkspacePath,
  isSensitiveWorkspacePath,
  isWorkspaceExemptApiPath,
} from "./contract"
import { authorizeWorkspaceRequest, isScaleTeamWorkspacesEnabled } from "./hub"
import {
  WORKSPACE_COOKIE_NAME,
  unsealWorkspaceSession,
} from "./session-cookie"

function deny(status: number, body: Record<string, unknown>): NextResponse {
  return NextResponse.json(body, { status })
}

function denyAndClear(
  status: number,
  body: Record<string, unknown>
): NextResponse {
  const response = NextResponse.json(body, { status })
  response.cookies.delete(WORKSPACE_COOKIE_NAME)
  return response
}

export async function enforceScaleWorkspaceGate(
  req: NextRequest
): Promise<NextResponse | null> {
  if (!isScaleTeamWorkspacesEnabled()) return null
  const raw = req.cookies.get(WORKSPACE_COOKIE_NAME)?.value
  if (!raw) return null

  const path = req.nextUrl.pathname
  if (!path.startsWith("/api/")) return null
  if (isWorkspaceExemptApiPath(path)) return null

  const sealed = await unsealWorkspaceSession(raw)
  if (!sealed) {
    return denyAndClear(403, {
      error: "Workspace session is invalid. Relaunch from Scale Plus.",
      code: "WORKSPACE_SESSION_INVALID",
    })
  }

  if (isSensitiveWorkspacePath(path)) {
    return deny(403, {
      error: "Workspace members cannot access owner settings, billing, or credentials.",
      code: "WORKSPACE_SENSITIVE_ROUTE",
    })
  }
  if (!isGeneralMemberWorkspacePath(path)) {
    return deny(403, {
      error: "This action is owner-only in a guest workspace.",
      code: "WORKSPACE_ROUTE_NOT_ALLOWED",
    })
  }

  const authorization = req.headers.get("authorization") || ""
  const token = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : ""
  if (!token) {
    return deny(401, {
      error: "A current Keycloak token is required for guest workspace access.",
      code: "WORKSPACE_TOKEN_REQUIRED",
    })
  }

  let result
  try {
    result = await authorizeWorkspaceRequest(sealed.context.workspace.id, token)
  } catch {
    // Credentials not configured or unexpected failure: fail closed.
    return deny(503, {
      error: "Guest workspace authorization is temporarily unavailable.",
      code: "WORKSPACE_AUTHORIZE_UNAVAILABLE",
    })
  }

  if (result.status === "unavailable") {
    return deny(503, {
      error: "Guest workspace authorization is temporarily unavailable.",
      code: "WORKSPACE_AUTHORIZE_UNAVAILABLE",
    })
  }
  if (result.status === "revoked") {
    return denyAndClear(409, {
      error: "Guest workspace access is no longer active.",
      code: "WORKSPACE_ACCESS_REVOKED",
      redirectUrl: "/",
    })
  }

  if (
    result.context.actor.keycloakSubject !== sealed.actorKeycloakSubject ||
    result.context.workspace.id !== sealed.context.workspace.id ||
    result.context.application.slug !== SCALE_WORKSPACE_APP_SLUG
  ) {
    return denyAndClear(403, {
      error: "Workspace actor validation failed.",
      code: "WORKSPACE_ACTOR_MISMATCH",
    })
  }

  return null
}
