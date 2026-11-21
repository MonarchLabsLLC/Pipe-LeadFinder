import { beforeEach, describe, expect, it, vi } from "vitest"

const db = vi.hoisted(() => ({
  jobRun: { findUnique: vi.fn() },
  leadListEntry: { findMany: vi.fn() },
  jobItem: { createMany: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
}))
const calls = vi.hoisted(() => ({ enrichEmail: vi.fn(), deduct: vi.fn(), check: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ prisma: db }))
vi.mock("@/lib/jobs/service", () => ({ createAndEnqueueJob: vi.fn(), updateJobProgress: vi.fn() }))
vi.mock("@/services/enrich-service", () => ({ enrichEmail: calls.enrichEmail, enrichPhone: vi.fn() }))
vi.mock("@/services/lead-scoring-service", () => ({ scoreLeadsForList: vi.fn() }))
vi.mock("@/lib/credit-guard", () => ({ deductCredits: calls.deduct }))
vi.mock("@/server/focused-agent/job-guard", () => ({ requireApprovedJob: vi.fn(), chargeApprovedJob: vi.fn() }))
vi.mock("@/services/credits-service", () => ({ consumeTokenCredits: vi.fn(), ensureCreditsAvailable: calls.check }))

const { processBulkJob } = await import("./bulk-job")

const payload = { userId: "u1", userEmail: "me@x.co", listId: "l1", entryIds: ["e1"], action: "ENRICH_EMAIL" }
const found = { email: "a@x.co", emailStatus: "FOUND" }

beforeEach(() => {
  vi.clearAllMocks()
  db.jobRun.findUnique.mockResolvedValue({ id: "job1", payload })
  calls.check.mockResolvedValue({ ok: true })
  calls.enrichEmail.mockResolvedValue(found)
})

describe("bulk enrichment billing", () => {
  it("charges a lookup that found data, keyed by job and lead", async () => {
    db.leadListEntry.findMany.mockResolvedValue([{ id: "e1", leadId: "lead1", lead: { email: null, emailStatus: "UNKNOWN" } }])
    db.jobItem.findFirst.mockResolvedValue({ status: "QUEUED", result: null, billedAt: null })
    await processBulkJob("job1")
    expect(calls.deduct).toHaveBeenCalledWith(
      "u1", "enrich:email", 1, expect.objectContaining({ leadId: "lead1", jobRunId: "job1" }), "me@x.co"
    )
  })

  it("does not charge a lead that already had the data (no lookup)", async () => {
    db.leadListEntry.findMany.mockResolvedValue([{ id: "e1", leadId: "lead1", lead: found }])
    db.jobItem.findFirst.mockResolvedValue({ status: "QUEUED", result: null, billedAt: null })
    await processBulkJob("job1")
    expect(calls.deduct).not.toHaveBeenCalled()
  })

  it("a retry still charges a lookup that saved its result before the crash", async () => {
    db.leadListEntry.findMany.mockResolvedValue([{ id: "e1", leadId: "lead1", lead: found }])
    db.jobItem.findFirst.mockResolvedValue({ status: "RUNNING", result: { hadDataBefore: false }, billedAt: null })
    await processBulkJob("job1")
    expect(calls.deduct).toHaveBeenCalledTimes(1)
  })

  it("never charges an item twice", async () => {
    db.leadListEntry.findMany.mockResolvedValue([{ id: "e1", leadId: "lead1", lead: found }])
    db.jobItem.findFirst.mockResolvedValue({ status: "RUNNING", result: { hadDataBefore: false }, billedAt: new Date() })
    await processBulkJob("job1")
    expect(calls.deduct).not.toHaveBeenCalled()
  })

  it("refuses to start lookups when the balance is negative or unreadable", async () => {
    db.leadListEntry.findMany.mockResolvedValue([{ id: "e1", leadId: "lead1", lead: { email: null, emailStatus: "UNKNOWN" } }])
    calls.check.mockResolvedValue({ ok: false, status: 503, message: "Billing is temporarily unavailable." })
    await expect(processBulkJob("job1")).rejects.toThrow(/unavailable/)
    expect(calls.enrichEmail).not.toHaveBeenCalled()
  })
})
