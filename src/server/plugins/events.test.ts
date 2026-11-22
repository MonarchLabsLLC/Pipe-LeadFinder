/**
 * Plugin events: what a finished job becomes, that queueing can never fail the
 * work that caused it, and how the outbox is forwarded (only for owners with
 * installs, retried on failure). The database and the dashboard are fakes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

type OutboxRow = { id: string; userId: string; type: string; occurredAt: Date; data: unknown; status: string; attempts: number; nextAttemptAt: Date | null; lastError: string | null; createdAt: Date }

const db = vi.hoisted(() => ({
  outbox: [] as OutboxRow[],
  users: new Map<string, string | null>(),
  failCreate: false,
  seq: 0,
}))

vi.mock("@/auth", () => ({ auth: async () => null }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    pluginEventOutbox: {
      create: async ({ data }: { data: { userId: string; type: string; data: unknown } }) => {
        if (db.failCreate) throw new Error("outbox table is missing")
        const row = { id: `evt-${++db.seq}`, occurredAt: new Date(), status: "PENDING", attempts: 0, nextAttemptAt: null, lastError: null, createdAt: new Date(), ...data }
        db.outbox.push(row)
        return row
      },
      findMany: async ({ where }: { where: { status: string } }) => db.outbox.filter((row) => row.status === where.status),
      deleteMany: async ({ where }: { where: { id: { in: string[] } } }) => {
        db.outbox = db.outbox.filter((row) => !where.id.in.includes(row.id))
        return { count: 0 }
      },
      updateMany: async ({ where, data }: { where: { id: string }; data: Partial<OutboxRow> }) => {
        for (const row of db.outbox) if (row.id === where.id) Object.assign(row, data)
        return { count: 1 }
      },
    },
    user: { findUnique: async ({ where }: { where: { id: string } }) => (db.users.has(where.id) ? { keycloakSubId: db.users.get(where.id) } : null) },
  },
}))

import { resetInstallsCache } from "./dashboard-client"
import { onPluginEventQueued, queuePluginActionOutcome, queuePluginEvent } from "./events"
import { PLUGIN_MAX_ATTEMPTS, forwardPluginEvents, nextPluginAttempt } from "./forwarder"
import { eventForAgentRun, eventsForJob } from "./job-events"
import { PLUGIN_EVENTS } from "./registry"

const SECRET = "test-only-plugin-service-secret-0123456789abcdef"
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- request bodies of two different shapes
const calls: { url: string; body: any }[] = []
let installs: unknown[] = []
let eventsStatus = 200

beforeEach(() => {
  process.env.SCALE_PLUGINS_ENABLED = "true"
  process.env.SCALE_PLUGIN_SERVICE_SECRET = SECRET
  process.env.SCALE_PLUGIN_GATEWAY_URL = "https://dashboard.test/"
  db.outbox = []
  db.users = new Map([["user-1", "owner-subject-1"]])
  db.failCreate = false
  calls.length = 0
  installs = [{ installId: "install-1", pluginId: "plugin-1", name: "Lead Radar" }]
  eventsStatus = 200
  resetInstallsCache()
  // Sending is driven by the tests, not by the background kick.
  onPluginEventQueued(() => {})
  vi.stubGlobal("fetch", async (url: string, init: { body: string; headers: Record<string, string> }) => {
    const body = JSON.parse(init.body)
    calls.push({ url, body })
    expect(init.headers.authorization).toMatch(/^Bearer /)
    if (url.endsWith("/installs")) return Response.json({ installs })
    if (eventsStatus !== 200) return new Response("no", { status: eventsStatus })
    return Response.json({ accepted: body.events.length })
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  onPluginEventQueued(null)
  delete process.env.SCALE_PLUGINS_ENABLED
  delete process.env.SCALE_PLUGIN_SERVICE_SECRET
  delete process.env.SCALE_PLUGIN_GATEWAY_URL
})

describe("what a finished job becomes", () => {
  it("a search: search.completed, and list.updated when leads were saved", () => {
    const job = { id: "job-1", kind: "SEARCH", listId: "list-1", searchId: "search-1", result: { resultCount: 7, providerResultCount: 9 } }
    expect(eventsForJob(job, "LOCAL")).toEqual([
      { type: "leadfinder.search.completed", data: { searchId: "search-1", listId: "list-1", searchType: "LOCAL", resultCount: 7, jobId: "job-1" } },
      { type: "leadfinder.list.updated", data: { listId: "list-1", reason: "leads_added", count: 7 } },
    ])
    expect(eventsForJob({ ...job, result: { resultCount: 0 } }, "LOCAL").map((event) => event.type)).toEqual(["leadfinder.search.completed"])
  })

  it("enrichment and scoring: enrichment.completed with counts", () => {
    expect(eventsForJob({ id: "job-2", kind: "BULK_ENRICH_EMAIL", listId: "list-1", searchId: null, result: { attempted: 5, enriched: 3, failed: 1 } })).toEqual([
      { type: "leadfinder.enrichment.completed", data: { jobId: "job-2", listId: "list-1", kind: "email", attempted: 5, succeeded: 3, failed: 1 } },
    ])
    expect(eventsForJob({ id: "job-3", kind: "BULK_SCORE", listId: "list-1", searchId: null, result: { attempted: 4, scoredCount: 4 } })[0].data).toMatchObject({ kind: "score", succeeded: 4 })
    expect(eventsForJob({ id: "job-4", kind: "INTEGRATION_DELIVERY", listId: "list-1", searchId: null, result: {} })).toEqual([])
  })

  it("carries ids and counts only, and only declared event types", () => {
    const declared = new Set(PLUGIN_EVENTS.map((event) => event.type))
    const leaky = { resultCount: 2, attempted: 2, enriched: 1, email: "a@b.test", leads: [{ fullName: "A Person", phone: "555" }], text: "notes" }
    for (const kind of ["SEARCH", "BULK_ENRICH_EMAIL", "BULK_ENRICH_PHONE", "BULK_SCORE"]) {
      for (const event of eventsForJob({ id: "job-1", kind, listId: "list-1", searchId: "search-1", result: leaky }, "PEOPLE")) {
        expect(declared.has(event.type)).toBe(true)
        expect(JSON.stringify(event.data)).not.toMatch(/a@b\.test|A Person|555|notes/)
        for (const value of Object.values(event.data)) expect(["string", "number"]).toContain(typeof value)
      }
    }
  })
})

describe("queueing", () => {
  it("writes nothing with the channel off", async () => {
    delete process.env.SCALE_PLUGINS_ENABLED
    await queuePluginEvent("user-1", { type: "leadfinder.list.updated", data: { listId: "list-1", reason: "labels_changed", count: 1 } })
    expect(db.outbox).toEqual([])
  })

  it("never throws, even when the outbox cannot be written", async () => {
    db.failCreate = true
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    await expect(queuePluginEvent("user-1", { type: "leadfinder.list.updated", data: { listId: "list-1", reason: "labels_changed", count: 1 } })).resolves.toBeUndefined()
    await expect(queuePluginActionOutcome("user-1", "rejected", { proposalId: "p-1", installId: "install-1" })).resolves.toBeUndefined()
    log.mockRestore()
  })
})

describe("forwarding", () => {
  it("sends an owner's events to the dashboard, signed, and removes them", async () => {
    await queuePluginEvent("user-1", { type: "leadfinder.search.completed", data: { searchId: "s-1", listId: "list-1", searchType: "LOCAL", resultCount: 3 } })
    const report = await forwardPluginEvents()
    expect(report).toMatchObject({ delivered: 1, dropped: 0, failed: 0 })
    const sent = calls.find((call) => call.url === "https://dashboard.test/api/platform/internal/events")
    expect(sent?.body.events).toHaveLength(1)
    expect(sent?.body.events[0]).toMatchObject({ type: "leadfinder.search.completed", ownerSubject: "owner-subject-1", tenantId: "user-1", data: { searchId: "s-1", resultCount: 3 } })
    expect(sent?.body.events[0].id).toBeTruthy()
    expect(db.outbox).toEqual([])
  })

  it("asks for installs once per owner within 60 seconds", async () => {
    await queuePluginEvent("user-1", { type: "leadfinder.list.updated", data: { listId: "list-1", reason: "leads_added", count: 1 } })
    await forwardPluginEvents()
    await queuePluginEvent("user-1", { type: "leadfinder.list.updated", data: { listId: "list-1", reason: "leads_added", count: 2 } })
    await forwardPluginEvents()
    expect(calls.filter((call) => call.url.endsWith("/installs"))).toHaveLength(1)
    expect(calls.filter((call) => call.url.endsWith("/events"))).toHaveLength(2)
  })

  it("drops events for an owner with no installs, or no ScalePlus identity, without sending them", async () => {
    installs = []
    db.users.set("user-2", null)
    await queuePluginEvent("user-1", { type: "leadfinder.list.updated", data: { listId: "list-1", reason: "leads_added", count: 1 } })
    await queuePluginEvent("user-2", { type: "leadfinder.list.updated", data: { listId: "list-2", reason: "leads_added", count: 1 } })
    const report = await forwardPluginEvents()
    expect(report).toMatchObject({ delivered: 0, dropped: 2 })
    expect(calls.some((call) => call.url.endsWith("/events"))).toBe(false)
    expect(db.outbox).toEqual([])
  })

  it("sends a proposal's outcome even when the install list is empty", async () => {
    installs = []
    await queuePluginActionOutcome("user-1", "approved", { proposalId: "p-1", installId: "install-1", status: "failed", result: { error: "Records or prices changed." } })
    expect((await forwardPluginEvents()).delivered).toBe(1)
    const sent = calls.find((call) => call.url.endsWith("/events"))
    expect(sent?.body.events[0]).toMatchObject({ type: "leadfinder.action.approved", data: { proposalId: "p-1", installId: "install-1", status: "failed", result: { error: "Records or prices changed." } } })
  })

  it("keeps a failed send for a later retry and never throws", async () => {
    eventsStatus = 503
    await queuePluginEvent("user-1", { type: "leadfinder.list.updated", data: { listId: "list-1", reason: "leads_added", count: 1 } })
    const now = new Date("2026-10-07T12:00:00.000Z")
    const report = await forwardPluginEvents({ now })
    expect(report).toMatchObject({ delivered: 0, failed: 1 })
    expect(db.outbox).toHaveLength(1)
    expect(db.outbox[0]).toMatchObject({ status: "PENDING", attempts: 1 })
    expect(db.outbox[0].nextAttemptAt?.toISOString()).toBe("2026-10-07T12:01:00.000Z")
    expect(db.outbox[0].lastError).toMatch(/503/)
  })

  it("backs off 1, 5, 15, 60 minutes and 6 hours, then gives up", () => {
    const now = new Date(0)
    expect([1, 2, 3, 4, 5].map((attempts) => nextPluginAttempt(attempts, now)!.getTime() / 1000)).toEqual([60, 300, 900, 3600, 21_600])
    expect(nextPluginAttempt(PLUGIN_MAX_ATTEMPTS, now)).toBeNull()
  })
})

describe("leadfinder.agent.run_completed", () => {
  const job = { id: "job-9", kind: "AGENT_RUN", status: "COMPLETED", agentId: "agent-1", listId: "list-1", searchId: "search-1", result: { leadCount: 7, totalLeadCount: 40, leads: [{ email: "a@b.invalid" }] } }

  it("carries ids and counts only", () => {
    expect(eventForAgentRun(job)).toEqual({
      type: "leadfinder.agent.run_completed",
      data: { agentId: "agent-1", jobId: "job-9", listId: "list-1", searchId: "search-1", leadCount: 7, totalLeadCount: 40 },
    })
    expect(JSON.stringify(eventForAgentRun(job))).not.toContain("@")
  })

  it("is sent only for a completed agent run", () => {
    expect(eventForAgentRun({ ...job, status: "FAILED" })).toBeNull()
    expect(eventForAgentRun({ ...job, kind: "SEARCH" })).toBeNull()
    expect(eventForAgentRun({ ...job, agentId: null })).toBeNull()
  })

  it("is in the contract", () => {
    expect(PLUGIN_EVENTS.map((event) => event.type)).toContain("leadfinder.agent.run_completed")
  })
})
