// The Scale Plugin Platform wire contract, as far as this app is concerned.
// Pure: no database, no environment, no server-only import, so every rule in
// here can be tested on its own. Source of truth: the dashboard's
// "Scale Plugin Platform: wire contracts" (sections 1 to 5).

export const PLUGIN_PROTOCOL_VERSION = "1"
/** This app's slug in every scope (`leadfinder.leads:read`) and event type. */
export const PLUGIN_APP = "leadfinder"
export const PLUGIN_APP_DISPLAY_NAME = "Lead Finder"
export const GATEWAY_ISSUER = "scaleplus-plugin-gateway"
export const APP_SERVICE_NAME = `${PLUGIN_APP}-plugin-service-v1`

/** Proposal outcomes: sent only to the install that asked, whatever it subscribes to (section 5). */
export const PLUGIN_ACTION_EVENT_PREFIX = `${PLUGIN_APP}.action.`

/** A plugin's pending approval waits this long, then expires. */
export const PLUGIN_PROPOSAL_TTL_MS = 72 * 60 * 60 * 1000

// ---------------------------------------------------------------------------
// Scopes
// ---------------------------------------------------------------------------

export type ActionLevel = "read" | "write" | "act"
export type ScopeLevel = ActionLevel | "act_unattended"

const LEVEL_RANK: Record<ScopeLevel, number> = { read: 0, write: 1, act: 2, act_unattended: 3 }

export interface ParsedScope {
  app: string
  area: string
  level: ScopeLevel
}

/** `leadfinder.searches:act` -> its parts; anything malformed is null. */
export function parseScope(scope: unknown): ParsedScope | null {
  if (typeof scope !== "string") return null
  const match = /^([a-z0-9]+)\.([a-z0-9_-]+):(read|write|act|act_unattended)$/.exec(scope)
  if (!match) return null
  return { app: match[1], area: match[2], level: match[3] as ScopeLevel }
}

/** The highest level the scopes grant for one area of THIS app, or null. */
export function grantedLevel(scopes: readonly unknown[], area: string): ScopeLevel | null {
  let best: ScopeLevel | null = null
  for (const raw of scopes) {
    const scope = parseScope(raw)
    if (!scope || scope.app !== PLUGIN_APP || scope.area !== area) continue
    if (best === null || LEVEL_RANK[scope.level] > LEVEL_RANK[best]) best = scope.level
  }
  return best
}

/** A higher level includes the lower ones in the same area. */
export function scopeAllows(scopes: readonly unknown[], area: string, level: ScopeLevel): boolean {
  const granted = grantedLevel(scopes, area)
  return granted !== null && LEVEL_RANK[granted] >= LEVEL_RANK[level]
}

/** The owner said this plugin may do consequential things here without asking. */
export function runsUnattended(scopes: readonly unknown[], area: string): boolean {
  return grantedLevel(scopes, area) === "act_unattended"
}

// ---------------------------------------------------------------------------
// Errors and envelopes
// ---------------------------------------------------------------------------

export type PluginErrorCode =
  | "invalid_service_token"
  | "scope_missing"
  | "unknown_action"
  | "invalid_input"
  | "tenant_required"
  | "tenant_not_found"
  | "not_found"
  | "app_error"

const STATUS_BY_CODE: Record<PluginErrorCode, number> = {
  invalid_service_token: 401,
  scope_missing: 403,
  unknown_action: 404,
  invalid_input: 422,
  tenant_required: 409,
  tenant_not_found: 404,
  not_found: 404,
  app_error: 500,
}

export class PluginError extends Error {
  readonly status: number
  constructor(
    readonly code: PluginErrorCode,
    message: string,
    readonly retryable = false
  ) {
    super(message)
    this.name = "PluginError"
    this.status = STATUS_BY_CODE[code]
  }
}

const NO_STORE = { "cache-control": "no-store" }

export function pluginJson(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE })
}

export function pluginErrorResponse(error: PluginError, requestId: string): Response {
  return pluginJson({ error: { code: error.code, message: error.message, retryable: error.retryable, requestId } }, error.status)
}

// ---------------------------------------------------------------------------
// Tenants
// ---------------------------------------------------------------------------

export interface PluginTenant {
  id: string
  name: string
}

/**
 * Which of the owner's workspaces a call acts in. One and none named: that
 * one. Several and none named: 409 tenant_required. A name that is not theirs
 * (or no workspace at all): 404 tenant_not_found.
 */
export function selectTenant(tenants: readonly PluginTenant[], tenantId: string | null | undefined): PluginTenant {
  if (tenantId) {
    const named = tenants.find((tenant) => tenant.id === tenantId)
    if (!named) throw new PluginError("tenant_not_found", "That workspace is not one this owner has in Lead Finder.")
    return named
  }
  if (tenants.length === 0) throw new PluginError("tenant_not_found", "This owner has no Lead Finder account yet.")
  if (tenants.length > 1) {
    throw new PluginError("tenant_required", "This owner has more than one Lead Finder workspace. Send tenantId (see GET /tenants).")
  }
  return tenants[0]
}

// ---------------------------------------------------------------------------
// Proposal status, as the contract names it
// ---------------------------------------------------------------------------

export type PluginProposalStatus = "pending" | "approved" | "rejected" | "expired" | "failed"

/**
 * This app's approval states (FocusedAgentApproval.status) on the contract's
 * five. "approved", "queued" and "completed" all mean the owner said yes (or
 * the plugin runs unattended) and the work was started; a background job that
 * then fails turns the answer into "failed" (see `jobFailed`). "needs_review"
 * (the work could not be started reliably) and "stale" (records or prices
 * changed after the plugin asked, so nothing ran) are both "failed".
 */
export function pluginProposalStatus(status: string, options: { expired?: boolean; jobFailed?: boolean } = {}): PluginProposalStatus {
  switch (status.toLowerCase()) {
    case "pending":
      return options.expired ? "expired" : "pending"
    case "approved":
    case "queued":
    case "completed":
      return options.jobFailed ? "failed" : "approved"
    case "rejected":
      return "rejected"
    case "expired":
      return "expired"
    default:
      return "failed"
  }
}

/** The actor recorded on everything a plugin does. */
export interface PluginActor {
  pluginId: string
  installId: string
  pluginName: string
}

/** The Lead Finder account a call acts in: the workspace owner's own. */
export interface PluginOwnerAccount {
  userId: string
  email: string
  /** The owner's Keycloak subject, as the dashboard sent it. */
  subject: string
}
