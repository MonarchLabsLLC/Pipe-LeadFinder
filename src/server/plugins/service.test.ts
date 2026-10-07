/**
 * The plugin service's request path, without a database: service-token
 * verification, scope enforcement, tenant selection, and unattended versus
 * approval. The tools and the proposal store are fakes (service.ts takes them
 * as `deps`); nothing here reaches Postgres, Scale Credits or a lead provider.
 */
import { createHash, randomUUID } from "node:crypto"
import { SignJWT } from "jose"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({ prisma: {} }))
vi.mock("@/auth", () => ({ auth: async () => null }))

import { FocusedAgentError } from "@/server/focused-agent/security"
import { grantedLevel, scopeAllows, selectTenant, pluginProposalStatus, PluginError, type PluginTenant } from "./contract"
import { toPluginError } from "./errors"
import { pluginActionNamed, pluginCapabilities } from "./registry"
import { handlePluginRequest, type ChangeMode, type PluginServiceDeps } from "./service"

const SECRET = "test-only-plugin-service-secret-0123456789abcdef"
const ROOT = "/api/plugins/service/v1"
const OWNER = "5b0f6c1e-6f0a-4f0e-9d58-0d2f6a1c9e11"
const NOW = new Date("2026-10-07T12:00:00.000Z")

const sha = (text: string) => createHash("sha256").update(text, "utf8").digest("hex")

interface TokenOptions {
  method?: string
  path: string
  body?: string
  scopes?: string[]
  installId?: string
  ownerSubject?: string
  secret?: string
  issuer?: string
  audience?: string
  iat?: number
  lifetime?: number
  jti?: string
  bodyHash?: string
  install?: boolean
}

async function token(options: TokenOptions) {
  const iat = options.iat ?? Math.floor(NOW.getTime() / 1000)
  return new SignJWT({
    method: options.method ?? "GET",
    path: options.path,
    bodyHash: options.bodyHash ?? sha(options.body ?? ""),
    requestId: randomUUID(),
    ...(options.install === false
      ? {}
      : {
          installId: options.installId ?? "install-1",
          pluginId: "plugin-1",
          pluginName: "Lead Radar",
          workspaceId: "ws-1",
          ownerSubject: options.ownerSubject ?? OWNER,
          scopes: options.scopes ?? [],
        }),
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(options.issuer ?? "scaleplus-plugin-gateway")
    .setAudience(options.audience ?? "leadfinder-plugin-service-v1")
    .setIssuedAt(iat)
    .setExpirationTime(iat + (options.lifetime ?? 30))
    .setJti(options.jti ?? randomUUID())
    .sign(new TextEncoder().encode(options.secret ?? SECRET))
}

const state = {
  nonces: new Set<string>(),
  tenants: [] as PluginTenant[],
  reads: [] as { action: string; userId: string; tenant: string }[],
  changes: [] as { action: string; mode: ChangeMode; key: string; plugin: string }[],
  records: [] as { action: string; outcome: string; installId: string; pluginName: string; userId: string | null }[],
  proposals: new Map<string, { installId: string; userId: string }>(),
  changeError: null as unknown,
}

const deps: PluginServiceDeps = {
  secret: () => SECRET,
  claimNonce: async (jti) => {
    if (state.nonces.has(jti)) return false
    state.nonces.add(jti)
    return true
  },
  accountForOwner: async (subject) =>
    subject === OWNER ? { owner: { userId: "user-1", email: "owner@test.invalid", subject }, tenants: state.tenants } : { owner: null, tenants: [] },
  capabilities: pluginCapabilities,
  actionNamed: pluginActionNamed,
  runRead: async (call, action) => {
    state.reads.push({ action: action.name, userId: call.owner.userId, tenant: call.tenant.id })
    return { ok: action.name }
  },
  runChange: async (call, action, _input, options) => {
    if (state.changeError) throw state.changeError
    state.changes.push({ action: action.name, mode: options.mode, key: options.idempotencyKey, plugin: call.actor.pluginName })
    if (options.mode === "approval") {
      const proposalId = randomUUID()
      state.proposals.set(proposalId, { installId: call.actor.installId, userId: call.owner.userId })
      return { kind: "pending", proposalId, expiresAt: new Date(call.now.getTime() + 72 * 3600 * 1000).toISOString() }
    }
    return { kind: "done", data: { status: options.mode === "unattended" ? "queued" : "completed", runId: "job-1" } }
  },
  proposalForInstall: async ({ id, installId, userId }) => {
    const row = state.proposals.get(id)
    return row && row.installId === installId && row.userId === userId ? { proposalId: id, status: "pending" } : null
  },
  record: async (entry) => {
    state.records.push({ action: entry.action.name, outcome: entry.outcome, installId: entry.actor.installId, pluginName: entry.actor.pluginName, userId: entry.userId })
  },
  now: () => NOW,
}

async function call(method: "GET" | "POST", route: string, options: Partial<TokenOptions> & { input?: unknown; tenantId?: string | null; raw?: string; authorization?: string } = {}) {
  const path = `${ROOT}/${route}`
  const body = method === "POST" ? (options.raw ?? JSON.stringify({ protocolVersion: "1", idempotencyKey: "key-1", tenantId: options.tenantId ?? null, input: options.input ?? {} })) : ""
  const authorization = options.authorization ?? `Bearer ${await token({ method, path, body, ...options })}`
  const request = new Request(`https://leadfinder.test${path}`, { method, headers: { authorization }, ...(method === "POST" ? { body } : {}) })
  const response = await handlePluginRequest({ request, rawBody: body, segments: route.split("?")[0].split("/"), requestId: "req-fallback" }, deps)
  return { status: response.status, json: (await response.json()) as Record<string, any> }
}

const SEARCH = { type: "LOCAL", parameters: { businessType: "dentist", location: "Austin, TX", listId: "list-1", resultsLimit: 10 } }

beforeEach(() => {
  state.nonces.clear()
  state.tenants = [{ id: "user-1", name: "Lead Finder" }]
  state.reads = []
  state.changes = []
  state.records = []
  state.proposals.clear()
  state.changeError = null
})

describe("service token", () => {
  it("accepts a correctly signed call", async () => {
    const result = await call("GET", "tenants")
    expect(result.status).toBe(200)
    expect(result.json.tenants).toEqual([{ id: "user-1", name: "Lead Finder" }])
  })

  it("refuses a missing token, a wrong secret, issuer or audience", async () => {
    for (const options of [
      { authorization: "" },
      { secret: "another-secret-that-is-also-long-enough-0123456789" },
      { issuer: "clickcampaigns-godmode-mcp" },
      { audience: "leadfinder-godmode-service-v1" },
      { audience: "pipeleads-plugin-service-v1" },
    ]) {
      const result = await call("GET", "tenants", options)
      expect(result.status).toBe(401)
      expect(result.json.error.code).toBe("invalid_service_token")
      expect(result.json.error.requestId).toBeTruthy()
    }
  })

  it("refuses an expired token, one from the future and one that lives longer than 30 seconds", async () => {
    const now = Math.floor(NOW.getTime() / 1000)
    expect((await call("GET", "tenants", { iat: now - 60 })).status).toBe(401)
    expect((await call("GET", "tenants", { iat: now + 60 })).status).toBe(401)
    expect((await call("GET", "tenants", { lifetime: 300 })).status).toBe(401)
    // Five seconds of clock skew are tolerated.
    expect((await call("GET", "tenants", { iat: now - 33 })).status).toBe(200)
  })

  it("refuses a nonce the second time", async () => {
    const jti = randomUUID()
    expect((await call("GET", "tenants", { jti })).status).toBe(200)
    const replay = await call("GET", "tenants", { jti })
    expect(replay.status).toBe(401)
    expect(replay.json.error.code).toBe("invalid_service_token")
  })

  it("refuses a token signed for another path, query string or method", async () => {
    const forTenants = `Bearer ${await token({ path: `${ROOT}/tenants` })}`
    expect((await call("GET", "capabilities", { authorization: forTenants })).status).toBe(401)
    expect((await call("GET", "tenants?x=1", { authorization: forTenants })).status).toBe(401)
    const asGet = `Bearer ${await token({ method: "GET", path: `${ROOT}/actions/list-labels` })}`
    expect((await call("POST", "actions/list-labels", { authorization: asGet, scopes: ["leadfinder.leads:read"] })).status).toBe(401)
    expect(state.reads).toEqual([])
  })

  it("refuses a body that is not the one that was signed", async () => {
    const result = await call("POST", "actions/list-labels", { scopes: ["leadfinder.leads:read"], bodyHash: sha('{"protocolVersion":"1","input":{}}') })
    expect(result.status).toBe(401)
    expect(result.json.error.code).toBe("invalid_service_token")
    expect(state.reads).toEqual([])
  })

  it("serves capabilities to a token with no install claims, and nothing else", async () => {
    const capabilities = await call("GET", "capabilities", { install: false })
    expect(capabilities.status).toBe(200)
    expect(capabilities.json.app).toBe("leadfinder")
    expect((await call("GET", "tenants", { install: false })).status).toBe(401)
    expect((await call("POST", "actions/list-labels", { install: false })).status).toBe(401)
  })
})

describe("scope enforcement", () => {
  it("refuses an action whose area the install holds nothing for", async () => {
    const result = await call("POST", "actions/get-list", { input: { listId: "list-1" }, scopes: ["leadfinder.credits:read"] })
    expect(result.status).toBe(403)
    expect(result.json.error.code).toBe("scope_missing")
    expect(state.reads).toEqual([])
    expect(state.records.at(-1)).toMatchObject({ action: "get-list", outcome: "denied", pluginName: "Lead Radar" })
  })

  it("ignores another app's scopes and malformed scopes", async () => {
    for (const scopes of [["pipeleads.leads:act_unattended"], ["leadfinder.leads"], ["leads:read"], ["leadfinder.leads:admin"]]) {
      expect((await call("POST", "actions/list-labels", { scopes })).status).toBe(403)
    }
  })

  it("lets a higher level include the lower ones, in the same area only", async () => {
    expect((await call("POST", "actions/list-recent-searches", { scopes: ["leadfinder.searches:act"] })).status).toBe(200)
    expect((await call("POST", "actions/list-labels", { scopes: ["leadfinder.leads:write"] })).status).toBe(200)
    expect((await call("POST", "actions/get-credits", { scopes: ["leadfinder.searches:act_unattended"] })).status).toBe(403)
    expect(scopeAllows(["leadfinder.searches:read"], "searches", "act")).toBe(false)
    expect(grantedLevel(["leadfinder.searches:read", "leadfinder.searches:act_unattended"], "searches")).toBe("act_unattended")
  })

  it("does not run a credit-spending action on read or write scope", async () => {
    for (const scopes of [["leadfinder.searches:read"], ["leadfinder.searches:write"], ["leadfinder.enrichment:act_unattended"]]) {
      const result = await call("POST", "actions/run-search", { input: SEARCH, scopes })
      expect(result.status).toBe(403)
    }
    expect(state.changes).toEqual([])
  })

  it("answers 404 unknown_action for an action that is not in the contract", async () => {
    for (const name of ["interpret-request", "prepare-handoff", "interpret_request", "send-to-crm"]) {
      const result = await call("POST", `actions/${name}`, { scopes: ["leadfinder.searches:act_unattended", "leadfinder.leads:act_unattended"] })
      expect(result.status).toBe(404)
      expect(result.json.error.code).toBe("unknown_action")
    }
  })

  it("validates input against the action's own schema", async () => {
    const result = await call("POST", "actions/get-list", { input: { listId: "list-1", everything: true }, scopes: ["leadfinder.leads:read"] })
    expect(result.status).toBe(422)
    expect(result.json.error.code).toBe("invalid_input")
    const notJson = await call("POST", "actions/list-labels", { raw: "not json", scopes: ["leadfinder.leads:read"] })
    expect(notJson.status).toBe(422)
  })
})

describe("tenant selection", () => {
  it("uses the owner's one account when no tenantId is given", async () => {
    const result = await call("POST", "actions/list-labels", { scopes: ["leadfinder.leads:read"] })
    expect(result.status).toBe(200)
    expect(result.json.data).toEqual({ ok: "list-labels" })
    expect(state.reads).toEqual([{ action: "list-labels", userId: "user-1", tenant: "user-1" }])
    expect(state.records.at(-1)).toMatchObject({ outcome: "completed", userId: "user-1", installId: "install-1" })
  })

  it("answers 409 tenant_required with several tenants and none named", async () => {
    state.tenants = [
      { id: "user-1", name: "One" },
      { id: "user-2", name: "Two" },
    ]
    const none = await call("POST", "actions/list-labels", { scopes: ["leadfinder.leads:read"] })
    expect(none.status).toBe(409)
    expect(none.json.error.code).toBe("tenant_required")
    const named = await call("POST", "actions/list-labels", { scopes: ["leadfinder.leads:read"], tenantId: "user-2" })
    expect(named.status).toBe(200)
    expect(state.reads).toEqual([{ action: "list-labels", userId: "user-1", tenant: "user-2" }])
  })

  it("answers 404 tenant_not_found for a tenant that is not the owner's, and for an owner with no account", async () => {
    const other = await call("POST", "actions/list-labels", { scopes: ["leadfinder.leads:read"], tenantId: "someone-else" })
    expect(other.status).toBe(404)
    expect(other.json.error.code).toBe("tenant_not_found")
    const stranger = await call("POST", "actions/list-labels", { scopes: ["leadfinder.leads:read"], ownerSubject: "0c0f6c1e-6f0a-4f0e-9d58-0d2f6a1c9e99" })
    expect(stranger.status).toBe(404)
    expect(stranger.json.error.code).toBe("tenant_not_found")
    expect((await call("GET", "tenants", { ownerSubject: "0c0f6c1e-6f0a-4f0e-9d58-0d2f6a1c9e99" })).json.tenants).toEqual([])
    expect(state.reads).toEqual([])
  })

  it("selectTenant follows the contract", () => {
    const one = [{ id: "a", name: "A" }]
    expect(selectTenant(one, null)).toEqual(one[0])
    expect(() => selectTenant([], null)).toThrow(PluginError)
    expect(() => selectTenant([...one, { id: "b", name: "B" }], undefined)).toThrow(/more than one/)
  })
})

describe("unattended versus approval", () => {
  it("files a pending proposal for an act action on plain act scope", async () => {
    const result = await call("POST", "actions/run-search", { input: SEARCH, scopes: ["leadfinder.searches:act"] })
    expect(result.status).toBe(202)
    expect(result.json.status).toBe("pending_approval")
    expect(result.json.proposalId).toBeTruthy()
    expect(new Date(result.json.expiresAt).getTime() - NOW.getTime()).toBe(72 * 3600 * 1000)
    expect(state.changes).toEqual([{ action: "run-search", mode: "approval", key: "key-1", plugin: "Lead Radar" }])
    expect(state.records.at(-1)).toMatchObject({ outcome: "pending_approval", pluginName: "Lead Radar" })
  })

  it("runs an act action directly when the owner granted act_unattended for that area", async () => {
    const result = await call("POST", "actions/run-search", { input: SEARCH, scopes: ["leadfinder.searches:act_unattended"] })
    expect(result.status).toBe(200)
    expect(result.json.data).toEqual({ status: "queued", runId: "job-1" })
    expect(state.changes[0].mode).toBe("unattended")
    expect(state.records.at(-1)).toMatchObject({ outcome: "executed_unattended" })
  })

  it("treats every credit-spending action the same way", async () => {
    const cases: [string, string, unknown][] = [
      ["rerun-search", "searches", { searchId: "search-1" }],
      ["enrich-leads", "enrichment", { listId: "list-1", leadIds: ["lead-1"], field: "email" }],
      ["enrich-list", "enrichment", { listId: "list-1" }],
      ["score-leads", "enrichment", { listId: "list-1", leadIds: ["lead-1"] }],
      ["create-agent", "agents", { name: "Weekly dentists", schedule: "weekly", type: "LOCAL", parameters: { businessType: "dentist", location: "Austin" } }],
    ]
    for (const [name, area, input] of cases) {
      state.changes = []
      expect((await call("POST", `actions/${name}`, { input, scopes: [`leadfinder.${area}:act`] })).status).toBe(202)
      expect((await call("POST", `actions/${name}`, { input, scopes: [`leadfinder.${area}:act_unattended`] })).status).toBe(200)
      expect(state.changes.map((change) => change.mode)).toEqual(["approval", "unattended"])
    }
  })

  it("does not let act_unattended in one area run another area's action unattended", async () => {
    const result = await call("POST", "actions/enrich-list", { input: { listId: "list-1" }, scopes: ["leadfinder.searches:act_unattended", "leadfinder.enrichment:act"] })
    expect(result.status).toBe(202)
    expect(state.changes[0].mode).toBe("approval")
  })

  it("runs a write action (labels) at once, with no proposal", async () => {
    const input = { listId: "list-1", leadIds: ["lead-1"], labelId: "label-1", operation: "apply" }
    const result = await call("POST", "actions/change-labels", { input, scopes: ["leadfinder.leads:write"] })
    expect(result.status).toBe(200)
    expect(state.changes[0].mode).toBe("direct")
    expect((await call("POST", "actions/change-labels", { input, scopes: ["leadfinder.leads:read"] })).status).toBe(403)
  })

  it("reports not enough credits as invalid_input, attended or not", async () => {
    state.changeError = new FocusedAgentError("INSUFFICIENT_CREDITS", "This operation requires up to 30 Scale Credits. Add credits first.", 402)
    for (const level of ["act", "act_unattended"]) {
      const result = await call("POST", "actions/run-search", { input: SEARCH, scopes: [`leadfinder.searches:${level}`] })
      expect(result.status).toBe(422)
      expect(result.json.error.code).toBe("invalid_input")
      expect(result.json.error.message).toMatch(/Not enough Scale Credits.*30 Scale Credits/)
      expect(result.json.error.retryable).toBe(false)
    }
    expect(state.records.at(-1)).toMatchObject({ outcome: "failed" })
  })

  it("maps the Agent's errors onto the contract's codes", () => {
    expect(toPluginError(new FocusedAgentError("LIST_NOT_FOUND", "This saved list is not available.", 404)).code).toBe("not_found")
    expect(toPluginError(new FocusedAgentError("NO_ELIGIBLE_LEADS", "Nothing to do.", 409)).code).toBe("invalid_input")
    const pricing = toPluginError(new FocusedAgentError("PRICING_UNAVAILABLE", "Current pricing is unavailable.", 503, true))
    expect([pricing.code, pricing.status, pricing.retryable]).toEqual(["app_error", 500, true])
    expect(toPluginError(new Error("boom")).code).toBe("app_error")
  })

  it("shows a proposal only to the install that filed it", async () => {
    const filed = await call("POST", "actions/run-search", { input: SEARCH, scopes: ["leadfinder.searches:act"] })
    const id = filed.json.proposalId as string
    const mine = await call("GET", `proposals/${id}`)
    expect(mine.status).toBe(200)
    expect(mine.json).toEqual({ proposalId: id, status: "pending" })
    const theirs = await call("GET", `proposals/${id}`, { installId: "install-2" })
    expect(theirs.status).toBe(404)
    expect(theirs.json.error.code).toBe("not_found")
    expect((await call("GET", `proposals/${randomUUID()}`)).status).toBe(404)
  })

  it("names proposal states the contract's way", () => {
    expect(pluginProposalStatus("pending")).toBe("pending")
    expect(pluginProposalStatus("pending", { expired: true })).toBe("expired")
    expect(pluginProposalStatus("queued")).toBe("approved")
    expect(pluginProposalStatus("completed")).toBe("approved")
    expect(pluginProposalStatus("queued", { jobFailed: true })).toBe("failed")
    expect(pluginProposalStatus("rejected")).toBe("rejected")
    expect(pluginProposalStatus("expired")).toBe("expired")
    expect(pluginProposalStatus("stale")).toBe("failed")
    expect(pluginProposalStatus("needs_review")).toBe("failed")
  })
})
