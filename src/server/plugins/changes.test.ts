/**
 * What a plugin's change does to the data: a pending proposal or a job, the
 * credit check, the owner's decision, staleness and expiry. Postgres, pricing,
 * Scale Credits and the job queue are fakes; no lead provider is called.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any -- in-memory rows

const db = vi.hoisted(() => ({
  approvals: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
  proposals: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
  outbox: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
  searchJobs: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
  bulkJobs: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
  extra: [] as string[],
  plan: null as Record<string, any> | null, // eslint-disable-line @typescript-eslint/no-explicit-any
  creditsError: null as Error | null,
  jobStatus: "RUNNING",
}))

vi.mock("@/auth", () => ({ auth: async () => null }))
vi.mock("@/lib/prisma", () => {
  const matches = (row: Row, where: Row) =>
    Object.entries(where).every(([key, value]) => {
      if (value && typeof value === "object" && !(value instanceof Date)) {
        if ("in" in value) return (value.in as unknown[]).includes(row[key])
        if ("gt" in value) return row[key] > value.gt
        if ("lte" in value) return row[key] <= value.lte
        return true
      }
      return row[key] === value
    })
  const table = (rows: () => Row[], key: string) => ({
    findUnique: async ({ where }: { where: Row }) => {
      const composite = where.userId_workspaceId_idempotencyKey as Row | undefined
      return rows().find((row) => (composite ? matches(row, composite) : row[key] === where[key])) ?? null
    },
    findUniqueOrThrow: async ({ where }: { where: Row }) => rows().find((row) => row[key] === where[key])!,
    findFirst: async ({ where }: { where: Row }) => rows().find((row) => matches(row, where)) ?? null,
    findMany: async ({ where }: { where: Row }) => rows().filter((row) => matches(row, where)),
    create: async ({ data }: { data: Row }) => {
      const row = { status: "pending", result: null, outcome: null, unattended: false, createdAt: new Date(), ...data }
      rows().push(row)
      return row
    },
    update: async ({ where, data }: { where: Row; data: Row }) => Object.assign(rows().find((row) => row[key] === where[key])!, data),
    updateMany: async ({ where, data }: { where: Row; data: Row }) => {
      const hit = rows().filter((row) => matches(row, where))
      for (const row of hit) Object.assign(row, data)
      return { count: hit.length }
    },
  })
  return {
    prisma: {
      focusedAgentApproval: table(() => db.approvals, "id"),
      pluginProposal: table(() => db.proposals, "approvalId"),
      pluginEventOutbox: table(() => db.outbox, "id"),
      user: { findUnique: async () => ({ id: "user-1", email: "owner@test.invalid" }) },
      jobRun: { findFirst: async () => ({ status: db.jobStatus, stage: "Running", errorMessage: null }) },
      leadList: { create: async ({ data }: { data: Row }) => ({ id: "new-list-1", ...data }) },
      leadListEntry: { findMany: async () => [{ id: "entry-1" }, { id: "entry-2" }] },
      $transaction: async (work: Promise<unknown>[]) => Promise.all(work),
    },
  }
})
vi.mock("@/server/focused-agent/plans", () => ({
  buildPlan: async () => JSON.parse(JSON.stringify(db.plan)),
  prepareSearchSchema: {},
  enrichSchema: {},
}))
vi.mock("@/server/focused-agent/plans-extra", () => ({
  EXTRA_PLAN_ACTIONS: ["label", "handoff", "agent"],
  executeExtraPlan: async (_a: unknown, plan: { action: string }) => {
    db.extra.push(plan.action)
    return plan.action === "label" ? { changed: 2, listId: "list-1", url: "/lead-search/saved-lists/list-1" } : { agentId: "agent-1", url: "/ai/ai-agent" }
  },
  labelChangeSchema: {},
  scheduledAgentSchema: {},
}))
vi.mock("@/server/focused-agent/pricing", () => ({
  requireCredits: async () => {
    if (db.creditsError) throw db.creditsError
    return 1000
  },
}))
vi.mock("@/server/focused-agent/tools", () => ({
  rerunSearchInput: async (_a: unknown, input: unknown) => input,
  bulkEnrichSelection: async (_a: unknown, input: unknown) => input,
  rerunSchema: {},
  bulkEnrichRequestSchema: {},
}))
vi.mock("@/services/search-job", () => ({
  enqueueSearchJob: async (input: Row) => {
    db.searchJobs.push(input)
    return { job: { id: "job-1" }, search: { id: "search-1" } }
  },
}))
vi.mock("@/services/bulk-job", () => ({
  enqueueBulkJob: async (input: Row) => {
    db.bulkJobs.push(input)
    return { id: "job-2" }
  },
}))

import { FocusedAgentError } from "@/server/focused-agent/security"
import { decidePluginProposal, expirePluginProposals, pendingPluginProposals, proposalForInstall, runPluginChange } from "./changes"
import { PluginError } from "./contract"
import { toPluginError } from "./errors"
import { onPluginEventQueued } from "./events"
import { pluginActionNamed } from "./registry"
import type { PluginCall } from "./service"

const NOW = new Date("2026-10-07T12:00:00.000Z")
const call: PluginCall = {
  actor: { pluginId: "plugin-1", installId: "install-1", pluginName: "Lead Radar" },
  owner: { userId: "user-1", email: "owner@test.invalid", subject: "5b0f6c1e-6f0a-4f0e-9d58-0d2f6a1c9e11" },
  tenant: { id: "user-1", name: "Lead Finder" },
  requestId: "req-1",
  now: NOW,
}
const action = (name: string) => pluginActionNamed(name)!

const searchPlan = (maximumCredits = 10) => ({
  action: "search",
  input: { type: "LOCAL", parameters: { businessType: "dentist", location: "Austin", listId: "list-1", duplicatePolicy: "ONLY_NEW", resultsLimit: 10 } },
  versions: { list: { id: "list-1", updatedAt: "2026-10-01T00:00:00.000Z" } },
  preview: {
    kind: "search",
    title: "Search for 10 local results",
    list: { id: "list-1", name: "Austin dentists" },
    cost: { action: "search:local", creditsPerUnit: maximumCredits / 10, maximumUnits: 10, maximumCredits },
    effects: ["Starts one paid search and saves results to this list."],
  },
})

const run = (name: string, mode: "direct" | "unattended" | "approval", idempotencyKey = "key-1", input: Row = {}) => runPluginChange(call, action(name), input, { mode, idempotencyKey })
const events = () => db.outbox.map((row) => ({ type: row.type, data: row.data }))

beforeEach(() => {
  process.env.SCALE_PLUGINS_ENABLED = "true"
  process.env.SCALE_PLUGIN_SERVICE_SECRET = "test-only-plugin-service-secret-0123456789abcdef"
  db.approvals = []
  db.proposals = []
  db.outbox = []
  db.searchJobs = []
  db.bulkJobs = []
  db.extra = []
  db.plan = searchPlan()
  db.creditsError = null
  db.jobStatus = "RUNNING"
  onPluginEventQueued(() => {})
})
afterEach(() => {
  onPluginEventQueued(null)
  delete process.env.SCALE_PLUGINS_ENABLED
  delete process.env.SCALE_PLUGIN_SERVICE_SECRET
})

describe("a plugin asks for a credit-spending action", () => {
  it("with approval: stores a pending proposal named after the plugin and starts nothing", async () => {
    const outcome = await run("run-search", "approval")
    expect(outcome.kind).toBe("pending")
    expect(db.searchJobs).toEqual([])
    const [row] = db.approvals
    expect(row).toMatchObject({ origin: "plugin", status: "pending", userId: "user-1", action: "search", subject: call.owner.subject })
    expect(row.preview.title).toBe("Lead Radar: Search for 10 local results")
    expect(row.preview.cost.maximumCredits).toBe(10)
    expect(row.preview.requestedBy).toEqual({ kind: "plugin", pluginName: "Lead Radar", pluginId: "plugin-1", installId: "install-1" })
    expect(row.expiresAt.getTime() - NOW.getTime()).toBe(72 * 3600 * 1000)
    expect(db.proposals[0]).toMatchObject({ approvalId: row.id, installId: "install-1", pluginId: "plugin-1", pluginName: "Lead Radar", actionName: "run-search", area: "searches", userId: "user-1" })
    expect(events()).toEqual([])
  })

  it("unattended: starts the product's normal search job at once, as the owner", async () => {
    const outcome = await run("run-search", "unattended")
    expect(outcome).toMatchObject({ kind: "done", data: { status: "queued", runId: "job-1", searchId: "search-1", listId: "list-1" } })
    expect(db.searchJobs).toHaveLength(1)
    expect(db.searchJobs[0]).toMatchObject({ userId: "user-1", userEmail: "owner@test.invalid", searchType: "LOCAL", listId: "list-1", duplicatePolicy: "ONLY_NEW", idempotencyKey: `plugin:${db.approvals[0].id}` })
    // Not the Agent's approved-job path: that one needs Pro Max and the Agent switches.
    expect(db.searchJobs[0].focusedAgentApprovalId).toBeUndefined()
    expect(db.searchJobs[0].searchParams).toEqual({ businessType: "dentist", location: "Austin", resultsLimit: 10 })
    expect(db.approvals[0]).toMatchObject({ status: "queued", approvalMethod: "plugin-unattended" })
    expect(db.proposals[0].unattended).toBe(true)
    expect(events()).toEqual([])
  })

  it("stores and starts nothing when the owner has too few credits, attended or not", async () => {
    db.creditsError = new FocusedAgentError("INSUFFICIENT_CREDITS", "This operation requires up to 10 Scale Credits. Add credits first.", 402)
    for (const mode of ["approval", "unattended"] as const) {
      const error = await run("run-search", mode).catch((caught: unknown) => caught)
      expect(toPluginError(error)).toMatchObject({ code: "invalid_input", status: 422 })
      expect(toPluginError(error).message).toMatch(/Not enough Scale Credits/)
    }
    expect(db.approvals).toEqual([])
    expect(db.searchJobs).toEqual([])
  })

  it("is idempotent on the plugin's key, per install", async () => {
    const first = await run("run-search", "approval", "same-key")
    const again = await run("run-search", "approval", "same-key")
    expect(again).toEqual(first)
    expect(db.approvals).toHaveLength(1)
    db.plan = { ...searchPlan(), input: { type: "LOCAL", parameters: { businessType: "plumber", location: "Austin", listId: "list-1", duplicatePolicy: "ONLY_NEW", resultsLimit: 10 } } }
    await expect(run("run-search", "approval", "same-key")).rejects.toBeInstanceOf(PluginError)

    db.plan = searchPlan()
    await run("run-search", "unattended", "run-once")
    const replay = await run("run-search", "unattended", "run-once")
    expect(replay).toMatchObject({ kind: "done", data: { status: "queued", runId: "job-1" } })
    expect(db.searchJobs).toHaveLength(1)
  })

  it("enrichment becomes the normal bulk job for exactly the eligible leads", async () => {
    db.plan = {
      action: "enrich",
      input: { listId: "list-1", leadIds: ["lead-1", "lead-2"], field: "phone" },
      versions: {},
      preview: { title: "Find phone details for 2 leads", eligibleLeadIds: ["lead-1", "lead-2"], cost: { maximumCredits: 2 }, effects: [] },
    }
    const outcome = await run("enrich-leads", "unattended")
    expect(outcome).toMatchObject({ kind: "done", data: { status: "queued", runId: "job-2", leads: 2 } })
    expect(db.bulkJobs[0]).toMatchObject({ userId: "user-1", listId: "list-1", entryIds: ["entry-1", "entry-2"], action: "ENRICH_PHONE" })
    expect(db.bulkJobs[0].focusedAgentApprovalId).toBeUndefined()
  })

  it("a label change (write) runs at once with no proposal, and reports the list as updated", async () => {
    db.plan = { action: "label", input: { listId: "list-1" }, versions: {}, preview: { title: "Apply a label", cost: { maximumCredits: 0 } } }
    const outcome = await run("change-labels", "direct")
    expect(outcome).toEqual({ kind: "done", data: { changed: 2, listId: "list-1", url: "/lead-search/saved-lists/list-1" } })
    expect(db.extra).toEqual(["label"])
    expect(db.approvals).toEqual([])
    expect(events()).toEqual([{ type: "leadfinder.list.updated", data: { listId: "list-1", reason: "labels_changed", count: 2 } }])
  })

  it("never runs a credit-spending plan in direct mode", async () => {
    await expect(run("run-search", "direct")).rejects.toBeInstanceOf(PluginError)
    expect(db.searchJobs).toEqual([])
  })
})

describe("the owner decides", () => {
  const file = async () => {
    const outcome = await run("run-search", "approval")
    if (outcome.kind !== "pending") throw new Error("expected a pending proposal")
    return outcome.proposalId
  }

  it("lists what is waiting, with the plugin's name and the cost", async () => {
    await file()
    const [waiting] = await pendingPluginProposals("user-1", NOW)
    expect(waiting).toMatchObject({ pluginName: "Lead Radar", actionName: "run-search", actionTitle: "Run a lead search", title: "Lead Radar: Search for 10 local results", status: "pending" })
    expect(waiting.cost).toMatchObject({ maximumCredits: 10 })
    expect(await pendingPluginProposals("someone-else", NOW)).toEqual([])
  })

  it("approve: starts the job and tells the plugin it was approved", async () => {
    const id = await file()
    const result = await decidePluginProposal({ userId: "user-1", id, decision: "approve", now: NOW })
    expect(result.status).toBe("queued")
    expect(db.searchJobs).toHaveLength(1)
    expect(db.approvals[0]).toMatchObject({ status: "queued", approvalMethod: "plugin-owner" })
    expect(events()).toEqual([
      { type: "leadfinder.action.approved", data: { proposalId: id, installId: "install-1", status: "executed", result: { status: "queued", runId: "job-1", searchId: "search-1", listId: "list-1" } } },
    ])
    // A second approval changes nothing and starts nothing.
    await decidePluginProposal({ userId: "user-1", id, decision: "approve", now: NOW })
    expect(db.searchJobs).toHaveLength(1)
    expect(db.outbox).toHaveLength(1)
  })

  it("reject: starts nothing and tells the plugin it was rejected", async () => {
    const id = await file()
    const result = await decidePluginProposal({ userId: "user-1", id, decision: "reject", now: NOW })
    expect(result.status).toBe("rejected")
    expect(db.searchJobs).toEqual([])
    expect(events()).toEqual([{ type: "leadfinder.action.rejected", data: { proposalId: id, installId: "install-1" } }])
  })

  it("only the owner of the account can decide", async () => {
    const id = await file()
    await expect(decidePluginProposal({ userId: "user-2", id, decision: "approve", now: NOW })).rejects.toMatchObject({ code: "PROPOSAL_NOT_FOUND" })
    expect(db.searchJobs).toEqual([])
  })

  it("a price or record change since the plugin asked: nothing runs, and it is reported as failed", async () => {
    const id = await file()
    db.plan = searchPlan(30)
    const result = await decidePluginProposal({ userId: "user-1", id, decision: "approve", now: NOW })
    expect(result.status).toBe("stale")
    expect(db.searchJobs).toEqual([])
    expect(events()).toEqual([
      { type: "leadfinder.action.approved", data: { proposalId: id, installId: "install-1", status: "failed", result: { error: "Records or prices changed after the plugin asked. Nothing was started and nothing was charged." } } },
    ])
    expect((await proposalForInstall({ id, installId: "install-1", userId: "user-1", now: NOW }))?.status).toBe("failed")
  })

  it("too few credits at approval time: an error for the owner, and the proposal stays pending", async () => {
    const id = await file()
    db.creditsError = new FocusedAgentError("INSUFFICIENT_CREDITS", "Add credits first.", 402)
    await expect(decidePluginProposal({ userId: "user-1", id, decision: "approve", now: NOW })).rejects.toMatchObject({ code: "INSUFFICIENT_CREDITS" })
    expect(db.approvals[0].status).toBe("pending")
    expect(db.searchJobs).toEqual([])
    expect(events()).toEqual([])
  })

  it("expires after 72 hours, once, and tells the plugin", async () => {
    const id = await file()
    const later = new Date(NOW.getTime() + 72 * 3600 * 1000 + 1000)
    expect(await expirePluginProposals(NOW)).toBe(0)
    expect(await expirePluginProposals(later)).toBe(1)
    expect(await expirePluginProposals(later)).toBe(0)
    expect(events()).toEqual([{ type: "leadfinder.action.expired", data: { proposalId: id, installId: "install-1" } }])
    const result = await decidePluginProposal({ userId: "user-1", id, decision: "approve", now: later })
    expect(result.status).toBe("expired")
    expect(db.searchJobs).toEqual([])
  })

  it("answers GET /proposals/:id only for the install that filed it, and follows the job", async () => {
    const id = await file()
    expect(await proposalForInstall({ id, installId: "install-1", userId: "user-1", now: NOW })).toEqual({ proposalId: id, status: "pending" })
    expect(await proposalForInstall({ id, installId: "install-2", userId: "user-1", now: NOW })).toBeNull()
    expect(await proposalForInstall({ id, installId: "install-1", userId: "user-2", now: NOW })).toBeNull()

    await decidePluginProposal({ userId: "user-1", id, decision: "approve", now: NOW })
    const approved = await proposalForInstall({ id, installId: "install-1", userId: "user-1", now: NOW })
    expect(approved).toMatchObject({ status: "approved", result: { runId: "job-1", run: { status: "running" } } })
    db.jobStatus = "FAILED"
    expect((await proposalForInstall({ id, installId: "install-1", userId: "user-1", now: NOW }))?.status).toBe("failed")
  })
})
