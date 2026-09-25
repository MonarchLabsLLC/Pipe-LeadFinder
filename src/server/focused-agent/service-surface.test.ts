/**
 * The signed ClickCampaigns Superpowers (MCP) service surface, without a
 * database: every agent-native action is reachable through the same signed,
 * entitlement-checked path; prepare_* only creates proposals; ask_user is not
 * exposed; and execute still needs the signed human approval grant.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { randomUUID } from "node:crypto"

const state = vi.hoisted(() => ({
  nonces: new Set<string>(),
  prepared: [] as { action: string; input: unknown; key: string }[],
  decided: [] as { id: string; hash: string; decision: string }[],
  reads: [] as string[],
  origin: "" as string,
}))

vi.mock("@/auth", () => ({ auth: async () => null }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    focusedAgentNonce: {
      create: async ({ data }: { data: { nonce: string } }) => {
        if (state.nonces.has(data.nonce)) throw Object.assign(new Error("dup"), { code: "P2002" })
        state.nonces.add(data.nonce)
        return data
      },
    },
    focusedAgentAudit: { create: async () => ({}) },
    customLabel: {
      findMany: async () => {
        state.reads.push("list_labels")
        return [{ id: "label-1", name: "Hot" }]
      },
    },
  },
}))
vi.mock("./access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./access")>()),
  resolveActor: async (subject: string, origin: "native" | "mcp", workspaceId?: string) => {
    state.origin = origin
    if (workspaceId !== undefined && workspaceId !== "user-1") {
      const { FocusedAgentError } = await import("./security")
      throw new FocusedAgentError("WORKSPACE_FORBIDDEN", "This Lead Finder workspace is not available.")
    }
    return { userId: "user-1", workspaceId: "user-1", subject, email: "u@test.invalid", origin }
  },
}))
vi.mock("./proposals", async (importOriginal) => {
  const { assertWrites } = await vi.importActual<typeof import("./access")>("./access")
  const view = (id: string, action: string) => ({
    id,
    action,
    status: "pending",
    proposalHash: "b".repeat(64),
    preview: { kind: action },
    expiresAt: new Date(Date.now() + 900000).toISOString(),
    approvalUrl: `https://app.pipeleads.ai/lead-search/saved-lists?agentApproval=${id}`,
  })
  return {
    ...(await importOriginal<typeof import("./proposals")>()),
    prepareProposal: async (_a: unknown, action: string, input: unknown, key: string) => {
      assertWrites()
      state.prepared.push({ action, input, key })
      return view(randomUUID(), action)
    },
    decideProposal: async (_a: unknown, id: string, hash: string, decision: string) => {
      state.decided.push({ id, hash, decision })
      return { ...view(id, "search"), status: "queued" }
    },
  }
})
vi.mock("./tools", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./tools")>()),
  interpretRequest: async (_a: unknown, text: string, key: string) => {
    state.reads.push(`interpret_request:${text}:${key}`)
    return { ok: true, searchType: "LOCAL", fields: { businessType: "Dentist" }, missingRequired: ["location"] }
  },
  creditsOverview: async () => {
    state.reads.push("get_credits")
    return { balance: 100, prices: [] }
  },
  recentSearches: async (_a: unknown, limit: number) => {
    state.reads.push(`list_recent_searches:${limit}`)
    return { searches: [] }
  },
  rerunSearchInput: async () => ({
    type: "PEOPLE",
    parameters: { listId: "list-1", description: "Founders" },
  }),
  bulkEnrichSelection: async () => ({ listId: "list-1", field: "email", leadIds: ["lead-1"] }),
}))
vi.mock("./suite-handoff", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./suite-handoff")>()),
  loadHandoffOptions: async (_a: unknown, target: string) => {
    state.reads.push(`get_handoff_options:${target}`)
    return target === "pipeleads"
      ? { pipelines: [{ id: "p1", name: "Sales", stages: [{ id: "s1", name: "New" }] }] }
      : { workspaceName: "Mail", lists: [{ id: "m1", name: "Newsletter" }], tags: [] }
  },
}))
vi.mock("./resources", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./resources")>()),
  ownedList: async (_a: unknown, id: string) => ({ id, name: "Florida dentists", status: "ACTIVE", type: "LOCAL" }),
}))

import { handleService } from "./http"
import { signFocusedRequest, type ApprovalEvidence } from "./security"
import { SERVICE_ACTIONS } from "./actions"

const secret = "test-only-secret-".repeat(4)
const subject = randomUUID()

async function call(
  method: "GET" | "POST",
  path: string,
  action: string,
  input?: unknown,
  approval?: ApprovalEvidence
) {
  const url = `/api/godmode/service/v1/${path}`
  const sessionId = randomUUID(),
    requestId = randomUUID()
  const body =
    method === "GET"
      ? null
      : {
          protocolVersion: "1",
          workspaceId: "user-1",
          input,
          idempotencyKey: randomUUID(),
          lineage: { threadId: "t", runId: "r", turnId: "t", mcpSessionId: sessionId, requestId },
        }
  const token = await signFocusedRequest({
    secret,
    issuer: "clickcampaigns-godmode-mcp",
    audience: "leadfinder-godmode-service-v1",
    subject,
    action,
    path: url,
    body,
    sessionId,
    requestId,
    approval,
  })
  const response = await handleService(
    new Request(`https://app.pipeleads.ai${url}`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    }),
    path.split("/")
  )
  return { status: response.status, json: await response.json(), body }
}
const act = (name: string, input: unknown, approval?: ApprovalEvidence) =>
  call("POST", `actions/${name}`, name, input, approval)

beforeEach(() => {
  vi.stubEnv("LEADFINDER_GODMODE_ENABLED", "true")
  vi.stubEnv("LEADFINDER_AGENT_WRITES_ENABLED", "true")
  vi.stubEnv("LEADFINDER_GODMODE_SERVICE_SECRET", secret)
  vi.stubEnv("AUTH_URL", "https://app.pipeleads.ai")
  Object.assign(state, { prepared: [], decided: [], reads: [], origin: "" })
})
afterEach(() => vi.unstubAllEnvs())

describe("MCP service surface", () => {
  it("advertises every agent-native tool except ask_user", async () => {
    const r = await call("GET", "capabilities", "capabilities")
    expect(r.status).toBe(200)
    const listed = r.json.data.actions as string[]
    for (const name of [
      "interpret_request",
      "get_credits",
      "list_recent_searches",
      "list_labels",
      "get_export_link",
      "get_handoff_options",
      "prepare_rerun_search",
      "prepare_bulk_enrichment",
      "prepare_label_change",
      "prepare_handoff",
      "prepare_scheduled_agent",
      "prepare_search",
      "execute_proposal",
    ])
      expect(listed).toContain(name)
    expect(listed).not.toContain("ask_user")
    expect(listed).toEqual([...SERVICE_ACTIONS, "execute_proposal"])
  })

  it("does not expose ask_user", async () => {
    const r = await act("ask_user", { question: "Which city?", options: ["Tampa", "Miami"] })
    expect(r.status).toBe(404)
    expect(r.json.error.code).toBe("UNSUPPORTED_ACTION")
  })

  it("runs the new read tools as the verified MCP actor", async () => {
    const interpreted = await act("interpret_request", { text: "dentists in Tampa" })
    expect(interpreted.status).toBe(200)
    expect(interpreted.json.data.missingRequired).toEqual(["location"])
    // Billing keeps the in-app idempotency: the MCP request's idempotency key.
    expect(state.reads[0]).toBe(
      `interpret_request:dentists in Tampa:${(interpreted.body as { idempotencyKey: string }).idempotencyKey}`
    )
    expect(state.origin).toBe("mcp")
    expect((await act("get_credits", {})).json.data.balance).toBe(100)
    expect((await act("list_recent_searches", { limit: 3 })).status).toBe(200)
    expect((await act("list_labels", {})).json.data.labels).toEqual([{ id: "label-1", name: "Hot" }])
    const options = await act("get_handoff_options", { target: "mailbaser" })
    expect(options.json.data.lists[0]).toEqual({ id: "m1", name: "Newsletter" })
    expect(state.reads).toEqual(
      expect.arrayContaining([
        "get_credits",
        "list_recent_searches:3",
        "list_labels",
        "get_handoff_options:mailbaser",
      ])
    )
    expect(state.prepared).toHaveLength(0)
  })

  it("returns an absolute CSV link for MCP callers", async () => {
    const r = await act("get_export_link", { listId: "list-1" })
    expect(r.status).toBe(200)
    expect(r.json.data.downloadUrl).toBe("https://app.pipeleads.ai/api/lists/list-1/export")
    expect(r.json.data.list.url).toBe("https://app.pipeleads.ai/lead-search/saved-lists/list-1")
    expect(r.json.data.note).toMatch(/signed in/)
  })

  it("validates inputs strictly", async () => {
    for (const [name, input] of [
      ["interpret_request", { text: "hi" }],
      ["get_credits", { extra: 1 }],
      ["list_recent_searches", { limit: 11 }],
      ["get_handoff_options", { target: "slack" }],
      ["prepare_label_change", { listId: "l", leadIds: [], labelId: "x", operation: "apply" }],
      ["prepare_bulk_enrichment", { listId: "l", limit: 501 }],
      [
        "prepare_scheduled_agent",
        { name: "x", schedule: "weekly", type: "PEOPLE", parametersJson: "{}" },
      ],
      ["prepare_search", { type: "PEOPLE", parametersJson: "{}" }],
    ] as const) {
      const r = await act(name, input)
      expect(r.status, name).toBe(400)
      expect(r.json.error.code).toBe("INVALID_INPUT")
    }
    expect(state.prepared).toHaveLength(0)
  })

  it("prepare_* tools only create proposals, with the approval link and standard fields", async () => {
    const cases = [
      ["prepare_rerun_search", { searchId: "search-1", resultsLimit: 5 }, "search"],
      ["prepare_bulk_enrichment", { listId: "list-1" }, "enrich_bulk"],
      [
        "prepare_label_change",
        { listId: "list-1", leadIds: ["lead-1"], labelId: "label-1", operation: "apply" },
        "label",
      ],
      [
        "prepare_handoff",
        { target: "pipeleads", listId: "list-1", leadIds: ["lead-1"], createDeals: true, pipelineId: "p1", stageId: "s1" },
        "handoff",
      ],
      [
        "prepare_scheduled_agent",
        {
          name: "Weekly founders",
          schedule: "weekly",
          type: "PEOPLE",
          parameters: { description: "Founders", location: "Ohio", resultsLimit: 5 },
        },
        "agent",
      ],
      [
        "prepare_search",
        { type: "LOCAL", parameters: { businessType: "Dentist", location: "Tampa, FL" }, newList: { name: "Dentists" } },
        "search",
      ],
    ] as const
    for (const [name, input, plan] of cases) {
      const r = await act(name, input)
      expect(r.status, name).toBe(200)
      expect(Object.keys(r.json.data)).toEqual(
        expect.arrayContaining(["id", "preview", "proposalHash", "expiresAt", "status", "approvalUrl"])
      )
      expect(r.json.data.status).toBe("pending")
      expect(r.json.data.approvalUrl).toMatch(/^https:\/\/app\.pipeleads\.ai\/lead-search\/saved-lists\?agentApproval=/)
      expect(state.prepared.at(-1)).toMatchObject({
        action: plan,
        key: (r.body as { idempotencyKey: string }).idempotencyKey,
      })
    }
    expect(state.prepared.find((p) => p.action === "enrich_bulk")?.input).toEqual({
      listId: "list-1",
      field: "email",
      leadIds: ["lead-1"],
    })
    expect(state.decided).toHaveLength(0)
  })

  it("refuses prepare_* when Agent writes are disabled", async () => {
    vi.stubEnv("LEADFINDER_AGENT_WRITES_ENABLED", "false")
    const r = await act("prepare_label_change", {
      listId: "list-1",
      leadIds: ["lead-1"],
      labelId: "label-1",
      operation: "remove",
    })
    expect(r.status).toBe(503)
    expect(r.json.error.code).toBe("WRITES_DISABLED")
    expect(state.prepared).toHaveLength(0)
  })

  it("rejects an approval grant on a prepare call and another workspace", async () => {
    const grant = { mode: "mcp-elicitation" as const, proposalId: randomUUID(), proposalHash: "b".repeat(64) }
    const r = await act("prepare_bulk_enrichment", { listId: "list-1" }, grant)
    expect(r.status).toBe(401)
    expect(r.json.error.code).toBe("UNEXPECTED_APPROVAL")
    expect(state.prepared).toHaveLength(0)
  })

  it("executes only with the signed human approval grant for that exact proposal", async () => {
    const proposalId = randomUUID(),
      proposalHash = "b".repeat(64)
    const path = `proposals/${proposalId}/execute`
    const missing = await call("POST", path, "execute_proposal", { proposalId, proposalHash })
    expect(missing.status).toBe(403)
    expect(missing.json.error.code).toBe("HUMAN_APPROVAL_REQUIRED")
    const other = await call("POST", path, "execute_proposal", { proposalId, proposalHash }, {
      mode: "mcp-elicitation",
      proposalId: randomUUID(),
      proposalHash,
    })
    expect(other.status).toBe(403)
    const confirmed = await call("POST", path, "execute_proposal", { proposalId, proposalHash, confirmed: true }, {
      mode: "mcp-elicitation",
      proposalId,
      proposalHash,
    })
    expect(confirmed.status).toBe(400)
    expect(state.decided).toHaveLength(0)
    const approved = await call("POST", path, "execute_proposal", { proposalId, proposalHash }, {
      mode: "mcp-elicitation",
      proposalId,
      proposalHash,
    })
    expect(approved.status).toBe(200)
    expect(state.decided).toEqual([{ id: proposalId, hash: proposalHash, decision: "approve" }])
  })
})
