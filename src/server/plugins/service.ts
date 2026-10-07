import { randomUUID } from "node:crypto"

import { z } from "zod"

import {
  PLUGIN_PROTOCOL_VERSION,
  PluginError,
  pluginErrorResponse,
  pluginJson,
  runsUnattended,
  scopeAllows,
  selectTenant,
  type PluginActor,
  type PluginOwnerAccount,
  type PluginProposalStatus,
  type PluginTenant,
} from "./contract"
import { toPluginError } from "./errors"
import type { PluginAction } from "./registry"
import { requireInstallClaims, verifyPluginToken, type PluginInstallClaims } from "./token"

// The plugin service (contract section 4): the ScalePlus dashboard calls in on
// behalf of one plugin install. The sibling of the Superpowers service at
// /api/godmode/service/v1, built from the same tools, plans and proposals.
//
//   GET  /capabilities        the capabilities contract (docs/plugin-capabilities.json)
//   GET  /tenants             the owner's Lead Finder account
//   POST /actions/:action     run one action
//   GET  /proposals/:id       what became of a pending consequential action
//
// No database in this file: the nonce ledger, the owner lookup, the tools and
// the proposal store arrive as `deps` (service.db.ts has the real ones), so the
// whole request path (token, scope, tenant, unattended or approval) is tested
// without Postgres.

export const MAX_PLUGIN_BODY_BYTES = 64 * 1024

const actionBodySchema = z.object({
  protocolVersion: z.literal(PLUGIN_PROTOCOL_VERSION),
  idempotencyKey: z.string().min(1).max(255).nullish(),
  tenantId: z.string().min(1).max(255).nullish(),
  input: z.record(z.string(), z.unknown()).nullish(),
})

/** One verified call: who is acting, for whom, in which account. */
export interface PluginCall {
  actor: PluginActor
  owner: PluginOwnerAccount
  tenant: PluginTenant
  requestId: string
  now: Date
}

/**
 * How a change runs:
 *   direct      a `write` action: it runs now
 *   unattended  an `act` action and the owner granted act_unattended: it runs now
 *   approval    an `act` action: a pending proposal for the owner to approve
 */
export type ChangeMode = "direct" | "unattended" | "approval"

export type ChangeOutcome = { kind: "done"; data: unknown; proposalId?: string } | { kind: "pending"; proposalId: string; expiresAt: string }

export interface ProposalStatusRow {
  proposalId: string
  status: PluginProposalStatus
  result?: unknown
}

export interface PluginServiceDeps {
  secret(): string
  /** Record a token nonce until it expires; false when it was already used. */
  claimNonce(jti: string, expiresAt: Date): Promise<boolean>
  /** The Lead Finder account the workspace owner has here, and so their tenants. */
  accountForOwner(ownerSubject: string): Promise<{ owner: PluginOwnerAccount | null; tenants: PluginTenant[] }>
  capabilities(): unknown
  actionNamed(name: string): PluginAction | null
  runRead(call: PluginCall, action: PluginAction, input: Record<string, unknown>): Promise<unknown>
  runChange(call: PluginCall, action: PluginAction, input: Record<string, unknown>, options: { mode: ChangeMode; idempotencyKey: string }): Promise<ChangeOutcome>
  /** A proposal this install filed in this owner's account (expired first, if due). */
  proposalForInstall(input: { id: string; installId: string; userId: string; now: Date }): Promise<ProposalStatusRow | null>
  /** The plugin as actor, on every call. Must not throw. */
  record(entry: {
    actor: PluginActor
    userId: string | null
    action: PluginAction
    outcome: "completed" | "executed_unattended" | "pending_approval" | "denied" | "failed"
    proposalId?: string
    requestId: string
    detail?: string
  }): Promise<void>
  now?(): Date
}

export interface PluginServiceRequest {
  request: Request
  rawBody: string
  segments: string[]
  requestId: string
}

const invalidToken = () => new PluginError("invalid_service_token", "This request is not signed correctly.")
const noSuchRoute = () => new PluginError("not_found", "There is no such Lead Finder plugin service endpoint.")

/** Handle one call. Never throws: every answer, errors included, is the contract's shape. */
export async function handlePluginRequest(input: PluginServiceRequest, deps: PluginServiceDeps): Promise<Response> {
  let requestId = input.requestId
  try {
    const { request, rawBody, segments } = input
    const now = deps.now?.() ?? new Date()
    const url = new URL(request.url)

    const verified = await verifyPluginToken({
      secret: deps.secret(),
      authorization: request.headers.get("authorization"),
      method: request.method,
      requestPath: `${url.pathname}${url.search}`,
      rawBody,
      claimNonce: deps.claimNonce,
      now,
    })
    if (!verified.ok) throw invalidToken()
    requestId = verified.claims.requestId

    if (Buffer.byteLength(rawBody, "utf8") > MAX_PLUGIN_BODY_BYTES) {
      throw new PluginError("invalid_input", "The request body is larger than 64 KB.")
    }

    const [head, id, ...rest] = segments
    if (rest.length > 0) throw noSuchRoute()

    // Describes the app, not an install: a token with no install claims may ask.
    if (request.method === "GET" && head === "capabilities" && !id) return pluginJson(deps.capabilities())

    // Everything else is done for one install, in one owner's account.
    const claims = requireInstallClaims(verified.claims)
    if (!claims) throw invalidToken()

    if (request.method === "GET" && head === "tenants" && !id) {
      const { tenants } = await deps.accountForOwner(claims.ownerSubject)
      return pluginJson({ tenants })
    }
    if (request.method === "POST" && head === "actions" && id) return await action(deps, claims, id, rawBody, requestId, now)
    if (request.method === "GET" && head === "proposals" && id) return await proposal(deps, claims, id, now)
    throw noSuchRoute()
  } catch (error) {
    return pluginErrorResponse(toPluginError(error), requestId)
  }
}

async function action(deps: PluginServiceDeps, claims: PluginInstallClaims, name: string, rawBody: string, requestId: string, now: Date): Promise<Response> {
  const definition = deps.actionNamed(name)
  if (!definition) throw new PluginError("unknown_action", `Lead Finder has no plugin action called ${name}.`)

  const actor: PluginActor = { pluginId: claims.pluginId, installId: claims.installId, pluginName: claims.pluginName }

  // Scope is enforced here, whatever the dashboard already checked.
  if (!scopeAllows(claims.scopes, definition.area, definition.level)) {
    await deps.record({ actor, userId: null, action: definition, outcome: "denied", requestId, detail: "scope_missing" })
    throw new PluginError("scope_missing", `This plugin does not hold leadfinder.${definition.area}:${definition.level}.`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawBody)
  } catch {
    throw new PluginError("invalid_input", "The request body must be JSON.")
  }
  const body = actionBodySchema.safeParse(parsed)
  if (!body.success) throw new PluginError("invalid_input", 'Send { "protocolVersion": "1", "idempotencyKey", "tenantId", "input" }.')

  const account = await deps.accountForOwner(claims.ownerSubject)
  const tenant = selectTenant(account.tenants, body.data.tenantId)
  if (!account.owner) throw new PluginError("tenant_not_found", "This owner has no Lead Finder account yet.")

  // The action's own schema: unknown fields, bad enums and out-of-range limits
  // are refused before anything is priced or read.
  const input = definition.schema.safeParse(body.data.input ?? {})
  if (!input.success) throw toPluginError(input.error)

  const call: PluginCall = { actor, owner: account.owner, tenant, requestId, now }
  const base = { actor, userId: account.owner.userId, action: definition, requestId }

  try {
    if (definition.level === "read") {
      const data = await deps.runRead(call, definition, input.data as Record<string, unknown>)
      await deps.record({ ...base, outcome: "completed" })
      return pluginJson({ data })
    }

    const mode: ChangeMode = definition.level === "write" ? "direct" : runsUnattended(claims.scopes, definition.area) ? "unattended" : "approval"
    const outcome = await deps.runChange(call, definition, input.data as Record<string, unknown>, {
      mode,
      idempotencyKey: body.data.idempotencyKey ?? randomUUID(),
    })
    if (outcome.kind === "pending") {
      await deps.record({ ...base, outcome: "pending_approval", proposalId: outcome.proposalId })
      return pluginJson({ status: "pending_approval", proposalId: outcome.proposalId, expiresAt: outcome.expiresAt }, 202)
    }
    await deps.record({ ...base, outcome: mode === "unattended" ? "executed_unattended" : "completed", proposalId: outcome.proposalId })
    return pluginJson({ data: outcome.data })
  } catch (error) {
    const mapped = toPluginError(error)
    await deps.record({ ...base, outcome: "failed", detail: mapped.code })
    throw mapped
  }
}

async function proposal(deps: PluginServiceDeps, claims: PluginInstallClaims, id: string, now: Date): Promise<Response> {
  const account = await deps.accountForOwner(claims.ownerSubject)
  if (!account.owner) throw new PluginError("not_found", "There is no such proposal.")
  // Only the install that filed it may ask, and only inside the owner's account.
  const row = await deps.proposalForInstall({ id, installId: claims.installId, userId: account.owner.userId, now })
  if (!row) throw new PluginError("not_found", "There is no such proposal.")
  return pluginJson({ proposalId: row.proposalId, status: row.status, ...(row.result !== undefined && row.result !== null ? { result: row.result } : {}) })
}
