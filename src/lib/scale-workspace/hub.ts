/**
 * Central Scale Plus workspace hub client (runtime-agnostic; fetch only).
 * Secrets are read from the environment and are never logged.
 */

import {
  SCALE_WORKSPACE_APP_SLUG,
  isWorkspaceContextV1,
  type WorkspaceContextV1,
} from "./contract"

const HUB_TIMEOUT_MS = 5_000

export function isScaleTeamWorkspacesEnabled(): boolean {
  return process.env.SCALE_TEAM_WORKSPACES_ENABLED === "true"
}

export function scaleWorkspaceHubUrl(): string {
  return (
    process.env.SCALE_WORKSPACE_HUB_URL || "https://app.scaleplus.gg"
  ).replace(/\/$/, "")
}

function appHeaders(): Record<string, string> {
  const clientId = process.env.SCALE_WORKSPACE_CLIENT_ID
  const clientSecret = process.env.SCALE_WORKSPACE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error("Scale workspace client credentials are not configured")
  }
  return {
    "Content-Type": "application/json",
    "X-Scale-Workspace-Client": clientId,
    "X-Scale-Workspace-Secret": clientSecret,
  }
}

export type WorkspaceExchangeResult = {
  context: WorkspaceContextV1
  returnPath: string
  allowedApplications: string[]
}

/**
 * Consume a single-use, app-bound launch code (2 minute expiry).
 * Returns null when the hub rejects the code or the payload fails
 * strict slug-bound validation.
 */
export async function exchangeWorkspaceLaunchCode(
  code: string
): Promise<WorkspaceExchangeResult | null> {
  const response = await fetch(
    `${scaleWorkspaceHubUrl()}/api/workspaces/v1/exchange`,
    {
      method: "POST",
      headers: appHeaders(),
      body: JSON.stringify({ code }),
      signal: AbortSignal.timeout(HUB_TIMEOUT_MS),
    }
  )
  if (!response.ok) return null
  const payload = (await response.json().catch(() => null)) as {
    context?: unknown
    returnPath?: unknown
    allowedApplications?: unknown
  } | null
  if (!payload || !isWorkspaceContextV1(payload.context, SCALE_WORKSPACE_APP_SLUG)) {
    return null
  }
  const returnPath =
    typeof payload.returnPath === "string" &&
    payload.returnPath.startsWith("/") &&
    !payload.returnPath.startsWith("//")
      ? payload.returnPath
      : "/"
  const allowedApplications = Array.isArray(payload.allowedApplications)
    ? payload.allowedApplications.filter(
        (value): value is string => typeof value === "string"
      )
    : [SCALE_WORKSPACE_APP_SLUG]
  return { context: payload.context, returnPath, allowedApplications }
}

export type WorkspaceAuthorizeResult =
  | { status: "ok"; context: WorkspaceContextV1; allowedApplications: string[] }
  | { status: "revoked" }
  | { status: "unavailable" }

/**
 * Revalidate the actor, membership, app grant, workspace state, and the
 * owner's live Pro Max group. Must be called on EVERY guest request with the
 * actor's CURRENT Keycloak access token. Failure or timeout denies.
 */
export async function authorizeWorkspaceRequest(
  workspaceId: string,
  actorAccessToken: string
): Promise<WorkspaceAuthorizeResult> {
  try {
    const response = await fetch(
      `${scaleWorkspaceHubUrl()}/api/workspaces/v1/authorize`,
      {
        method: "POST",
        headers: {
          ...appHeaders(),
          Authorization: `Bearer ${actorAccessToken}`,
        },
        body: JSON.stringify({ workspaceId }),
        signal: AbortSignal.timeout(HUB_TIMEOUT_MS),
      }
    )
    if (!response.ok) return { status: "revoked" }
    const payload = (await response.json().catch(() => null)) as {
      context?: unknown
      allowedApplications?: unknown
    } | null
    if (
      !payload ||
      !isWorkspaceContextV1(payload.context, SCALE_WORKSPACE_APP_SLUG)
    ) {
      return { status: "revoked" }
    }
    return {
      status: "ok",
      context: payload.context,
      allowedApplications: Array.isArray(payload.allowedApplications)
        ? payload.allowedApplications.filter(
            (value): value is string => typeof value === "string"
          )
        : [SCALE_WORKSPACE_APP_SLUG],
    }
  } catch {
    return { status: "unavailable" }
  }
}
