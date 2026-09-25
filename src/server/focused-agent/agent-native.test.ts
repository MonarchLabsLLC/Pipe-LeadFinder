import { afterEach, describe, expect, it, vi } from "vitest"
import { randomUUID } from "node:crypto"

vi.mock("@/lib/prisma", () => ({ prisma: {} }))
vi.mock("@/auth", () => ({ auth: async () => null }))

import { actions, SERVICE_ACTIONS } from "./actions"
import { requireAgentEntitlement } from "./access"
import { devBypass, devSubject } from "./dev-bypass"
import { tokenBillingPayload } from "./pricing"
import { AGENT_INSTRUCTIONS, MAX_AGENT_STEPS, normalizeToolInput, questionMessage } from "./runtime"
import { askUserSchema, missingSearchFields } from "./tools"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("ask_user contract", () => {
  it("accepts one question with 2-4 short options and defaults to allowing a free answer", () => {
    const q = askUserSchema.parse({ question: "Which city?", options: ["Tampa, FL", "Miami, FL"] })
    expect(q.allowOther).toBe(true)
    expect(askUserSchema.safeParse({ question: "Which city?", options: ["Only one"] }).success).toBe(false)
    expect(askUserSchema.safeParse({ question: "Which city?", options: ["a", "b", "c", "d", "e"] }).success).toBe(false)
    expect(askUserSchema.safeParse({ question: "Which city?", options: ["a", "x".repeat(61)] }).success).toBe(false)
    expect(askUserSchema.safeParse({ question: "Which city?", options: ["a", "b"], extra: 1 }).success).toBe(false)
  })
  it("stores the question as metadata for the buttons and as readable text for the model's history", () => {
    const q = askUserSchema.parse({ question: "How many results?", options: ["10", "25", "50"] })
    const m = questionMessage("Got it — dentists.", q)
    expect(m.metadata).toEqual({ kind: "question", lead: "Got it — dentists.", question: q })
    expect(m.content).toContain("How many results?")
    expect(m.content).toContain("10 · 25 · 50 · or something else")
  })
})

describe("tool registry", () => {
  it("has only read and prepare tools: the model can never execute", () => {
    for (const [name, definition] of Object.entries(actions)) {
      expect(["read", "prepare"]).toContain(definition.tier)
      expect(name).not.toMatch(/execute|approve|delete/)
      if (name.startsWith("prepare_")) expect(definition.tier).toBe("prepare")
    }
  })
  it("exposes the agent-native tools to the ClickCampaigns MCP service, except ask_user", () => {
    expect([...SERVICE_ACTIONS].sort()).toEqual(
      [
        "get_crm_destinations",
        "get_crm_transfer_status",
        "prepare_crm_transfer",
        "list_resources",
        "get_list",
        "prepare_search",
        "prepare_enrichment",
        "prepare_scoring",
        "get_run",
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
      ].sort()
    )
    expect(SERVICE_ACTIONS).not.toContain("ask_user" as never)
    // Every registry tool but ask_user is on the service, and none can execute.
    expect(Object.keys(actions).filter((name) => !(SERVICE_ACTIONS as readonly string[]).includes(name))).toEqual(["ask_user"])
    for (const name of SERVICE_ACTIONS)
      expect(actions[name].tier).toBe(name.startsWith("prepare_") ? "prepare" : "read")
  })
  it("takes structured parameters (not parametersJson) for the service's search-shaped tools", () => {
    expect(
      actions.prepare_scheduled_agent.schema.safeParse({
        name: "Weekly",
        schedule: "weekly",
        type: "PEOPLE",
        parameters: { description: "Founders" },
      }).success
    ).toBe(true)
    expect(
      actions.prepare_scheduled_agent.schema.safeParse({ name: "Weekly", schedule: "weekly", type: "PEOPLE", parametersJson: "{}" }).success
    ).toBe(false)
    expect(actions.prepare_search.schema.safeParse({ type: "PEOPLE", parametersJson: "{}" }).success).toBe(false)
  })
  it("validates the new tools strictly", () => {
    expect(actions.prepare_label_change.schema.safeParse({ listId: "l", leadIds: [], labelId: "x", operation: "apply" }).success).toBe(false)
    expect(actions.prepare_handoff.schema.safeParse({ target: "slack", listId: "l", leadIds: ["a"] }).success).toBe(false)
    expect(actions.prepare_handoff.schema.safeParse({ target: "mailbaser", listId: "l", leadIds: Array(51).fill("a") }).success).toBe(false)
    expect(actions.prepare_scheduled_agent.schema.safeParse({ name: "x", schedule: "hourly", type: "PEOPLE", parameters: {} }).success).toBe(false)
    expect(actions.prepare_bulk_enrichment.schema.parse({ listId: "l" })).toEqual({ listId: "l", field: "email", limit: 100 })
    expect(actions.prepare_bulk_enrichment.schema.safeParse({ listId: "l", limit: 501 }).success).toBe(false)
  })
  it("turns the model's JSON parameters into a validated search input, with an optional new list", () => {
    expect(
      normalizeToolInput("prepare_search", {
        type: "LOCAL",
        parametersJson: JSON.stringify({ businessType: "Dentist", location: "Tampa, FL", resultsLimit: 10 }),
        newListName: " Dentists – Tampa ",
      })
    ).toEqual({
      type: "LOCAL",
      parameters: { businessType: "Dentist", location: "Tampa, FL", resultsLimit: 10 },
      newList: { name: "Dentists – Tampa" },
    })
    expect(() => normalizeToolInput("prepare_search", { type: "LOCAL", parametersJson: "{not json" })).toThrow()
    expect(() => normalizeToolInput("prepare_search", { type: "LOCAL", parametersJson: "{}", hack: 1 })).toThrow()
  })
  it("reports only the required details that are missing", () => {
    expect(missingSearchFields("LOCAL", { businessType: "Dentist" })).toEqual(["location"])
    expect(missingSearchFields("COMPANY", { industry: "SaaS" })).toEqual([])
    expect(missingSearchFields("INFLUENCER", { description: "fitness" })).toEqual(["location", "platform"])
  })
  it("runs up to 8 steps and tells the model to ask, not assume, and never claim unapproved work", () => {
    expect(MAX_AGENT_STEPS).toBe(8)
    expect(AGENT_INSTRUCTIONS).toContain("ask_user")
    expect(AGENT_INSTRUCTIONS).toMatch(/at most 3 questions/)
    expect(AGENT_INSTRUCTIONS).toMatch(/Never say a search, enrichment.*has started/)
  })
})

describe("billing payload", () => {
  it("bills each step's real tokens to OpenRouter's model with a stable idempotency key", () => {
    expect(
      tokenBillingPayload({
        provider: "openrouter",
        model: "deepseek/deepseek-v4.1-flash",
        runId: "run-1",
        step: 3,
        inputTokens: 1200,
        outputTokens: 80,
      })
    ).toEqual({
      provider: "openrouter",
      model: "deepseek/deepseek-v4.1-flash",
      inputTokens: 1200,
      outputTokens: 80,
      description: "Lead Finder focused Agent",
      metadata: { feature: "focused-agent", runId: "run-1", step: 3 },
      idempotencyKey: "focused-agent:run-1:3",
    })
  })
})

describe("Pro Max entitlement fails closed", () => {
  const subject = randomUUID()
  function configure() {
    vi.stubEnv("LEADFINDER_GODMODE_SERVICE_SECRET", "test-only-secret-".repeat(4))
    vi.stubEnv("CLICKCAMPAIGNS_GODMODE_BASE_URL", "http://localhost:15440")
  }
  it("denies when the entitlement service is not configured", async () => {
    vi.stubEnv("LEADFINDER_GODMODE_SERVICE_SECRET", "")
    await expect(requireAgentEntitlement(subject)).rejects.toMatchObject({ code: "SERVICE_NOT_CONFIGURED" })
  })
  it("denies when the service cannot be reached", async () => {
    configure()
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline") }))
    await expect(requireAgentEntitlement(subject)).rejects.toMatchObject({ code: "ENTITLEMENT_UNAVAILABLE", status: 503 })
  })
  it("denies on an inactive plan, a suspended account, another subject or a malformed answer", async () => {
    configure()
    const answers = [
      { active: false, godmode: true, suspended: false, subject },
      { active: true, godmode: true, suspended: true, subject },
      { active: true, godmode: true, suspended: false, subject: randomUUID() },
      { active: "yes", godmode: true, suspended: false, subject },
    ]
    for (const data of answers) {
      vi.stubGlobal("fetch", vi.fn(async () => Response.json({ protocolVersion: "1", data })))
      await expect(requireAgentEntitlement(subject)).rejects.toMatchObject({ code: "PROMAX_REQUIRED", status: 403 })
    }
    vi.stubGlobal("fetch", vi.fn(async () => new Response("oops", { status: 500 })))
    await expect(requireAgentEntitlement(subject)).rejects.toMatchObject({ code: "PROMAX_REQUIRED" })
  })
  it("allows an active Pro Max answer for the same subject", async () => {
    configure()
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ protocolVersion: "1", data: { subject, active: true, godmode: true, suspended: false } }))
    )
    await expect(requireAgentEntitlement(subject)).resolves.toBeUndefined()
  })
})

describe("development bypass", () => {
  it("is ignored outside NODE_ENV=development", () => {
    expect(devBypass({ NODE_ENV: "production", LEADFINDER_AGENT_DEV_BYPASS: "promax" })).toBeNull()
    expect(devBypass({ NODE_ENV: "test", LEADFINDER_AGENT_DEV_BYPASS: "promax" })).toBeNull()
    expect(devBypass({ NODE_ENV: "development", LEADFINDER_AGENT_DEV_BYPASS: "promax" })).toBe("promax")
    expect(devBypass({ NODE_ENV: "development", LEADFINDER_AGENT_DEV_BYPASS: "none" })).toBe("none")
    expect(devBypass({ NODE_ENV: "development", LEADFINDER_AGENT_DEV_BYPASS: "yes" })).toBeNull()
  })
  it("never lets a dev subject through the real entitlement check", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("LEADFINDER_AGENT_DEV_BYPASS", "promax")
    const fetch = vi.fn()
    vi.stubGlobal("fetch", fetch)
    await expect(requireAgentEntitlement(devSubject("dev-admin-001"))).rejects.toMatchObject({ code: "WORKSPACE_FORBIDDEN" })
    expect(fetch).not.toHaveBeenCalled()
  })
  it("in development, 'none' behaves like a user without Pro Max", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("LEADFINDER_AGENT_DEV_BYPASS", "none")
    await expect(requireAgentEntitlement(devSubject("u"))).rejects.toMatchObject({ code: "PROMAX_REQUIRED" })
    vi.stubEnv("LEADFINDER_AGENT_DEV_BYPASS", "promax")
    await expect(requireAgentEntitlement(devSubject("u"))).resolves.toBeUndefined()
  })
})
