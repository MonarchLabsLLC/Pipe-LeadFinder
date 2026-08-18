/**
 * Scale Plus Team Workspace contract for PipeLeads LeadFinder.
 *
 * Pure, runtime-agnostic module (no Node/Prisma imports) so it can be shared
 * by the request proxy gate, route handlers, and tests.
 *
 * The whole feature is disabled by default (SCALE_TEAM_WORKSPACES_ENABLED=false).
 */

export const SCALE_WORKSPACE_APP_SLUG = "pipeleadsfinder"

export type WorkspaceContextV1 = {
  version: 1
  actor: { keycloakSubject: string; email: string }
  workspace: { id: string; displayName: string; type: "guest" }
  owner: { keycloakSubject: string; displayName: string; email: string }
  membership: { role: "member"; status: "active" }
  application: { slug: string; capability: "general-member" }
  authorizationVersion: string
  expiresAt: string
}

/**
 * Strict validation of the central WorkspaceContextV1 payload, bound to THIS
 * application's slug. Anything that does not match an active general-member
 * guest context for pipeleadsfinder is rejected.
 */
export function isWorkspaceContextV1(
  value: unknown,
  applicationSlug: string
): value is WorkspaceContextV1 {
  if (!value || typeof value !== "object") return false
  const context = value as WorkspaceContextV1
  return (
    context.version === 1 &&
    context.workspace?.type === "guest" &&
    typeof context.workspace?.id === "string" &&
    context.workspace.id.length > 0 &&
    typeof context.workspace?.displayName === "string" &&
    context.membership?.role === "member" &&
    context.membership?.status === "active" &&
    context.application?.slug === applicationSlug &&
    context.application?.capability === "general-member" &&
    typeof context.actor?.keycloakSubject === "string" &&
    context.actor.keycloakSubject.length > 0 &&
    typeof context.actor?.email === "string" &&
    typeof context.owner?.keycloakSubject === "string" &&
    context.owner.keycloakSubject.length > 0 &&
    typeof context.owner?.email === "string" &&
    typeof context.authorizationVersion === "string" &&
    Number.isFinite(Date.parse(context.expiresAt))
  )
}

/**
 * API paths a signed-in guest may never touch: billing, balances, credit
 * purchase, credentials, integrations/webhooks, storage, automation that can
 * post to external webhooks, and admin surfaces. Checked BEFORE the member
 * allowlist so an overlap always denies.
 */
export function isSensitiveWorkspacePath(path: string): boolean {
  if (path === "/api/credits/pricing") return false // public pricing table, no balances
  return (
    path === "/api/credits" ||
    path.startsWith("/api/credits/") ||
    path === "/api/integrations" ||
    path.startsWith("/api/integrations/") ||
    path === "/api/files" ||
    path.startsWith("/api/files/") ||
    path.startsWith("/api/ai/agent") ||
    path.startsWith("/api/admin") ||
    path.startsWith("/api/godmode") ||
    path === "/api/auth/dev-login" ||
    /^\/api\/search\/[^/]+\/schedule(?:\/|$)/.test(path)
  )
}

/**
 * Normal member work: lead search, saved lists, leads, labels, enrichment,
 * job/search status polling, location autocomplete, and the sanitized
 * display-context endpoint. Every guest API request outside this list is
 * denied (fail-closed allowlist) — newly added routes are guest-blocked until
 * they are classified here AND tenant-scoped via resolveWorkspaceScope.
 */
export function isGeneralMemberWorkspacePath(path: string): boolean {
  // AI list scoring spends token credits and is not yet tenant-scoped.
  if (/^\/api\/lists\/[^/]+\/score(?:\/|$)/.test(path)) return false
  const prefixes = ["/api/labels", "/api/lists", "/api/leads", "/api/enrich"]
  if (prefixes.some((p) => path === p || path.startsWith(`${p}/`))) return true
  if (/^\/api\/search\/(people|local|company|domain|influencer)$/.test(path)) {
    return true
  }
  if (/^\/api\/search\/[^/]+\/status$/.test(path)) return true
  if (/^\/api\/jobs\/[^/]+$/.test(path)) return true
  return (
    path === "/api/location-search" ||
    path === "/api/credits/pricing" ||
    path === "/api/scale-workspace/display-context"
  )
}

/**
 * Paths the guest gate never intercepts: the member's own Auth.js session
 * endpoints (sign-out must keep working), health checks, and the sanitized
 * display-context route (needed to bootstrap the client bridge before the
 * Authorization header interceptor is installed). dev-login stays sensitive.
 */
export function isWorkspaceExemptApiPath(path: string): boolean {
  if (path === "/api/auth/dev-login") return false
  return (
    path.startsWith("/api/auth/") ||
    path === "/api/health" ||
    path.startsWith("/api/scale-workspace/")
  )
}
