import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------
const db = vi.hoisted(() => ({
  jobRun: { findUnique: vi.fn() },
  searchHistory: { findUnique: vi.fn(), update: vi.fn() },
  user: { findUnique: vi.fn() },
  pendingCreditCharge: { upsert: vi.fn() },
}))
const calls = vi.hoisted(() => ({
  executeSearch: vi.fn(),
  persist: vi.fn(),
  deduct: vi.fn(),
  markFailed: vi.fn(),
  progress: vi.fn(),
}))
vi.mock("@/lib/prisma", () => ({ prisma: db }))
vi.mock("@/lib/jobs/service", () => ({
  createAndEnqueueJob: vi.fn(),
  updateJobProgress: calls.progress,
}))
vi.mock("@/services/search-service", () => ({
  assertSearchConfigured: vi.fn(),
  executeSearch: calls.executeSearch,
}))
vi.mock("@/services/search-persistence", () => ({
  persistSearchResults: calls.persist,
  markSearchFailed: calls.markFailed,
}))
vi.mock("@/lib/credit-guard", () => ({ deductCredits: calls.deduct }))
vi.mock("@/server/focused-agent/job-guard", () => ({
  requireApprovedJob: vi.fn(),
  chargeApprovedJob: vi.fn(),
}))

const { processSearchJob } = await import("./search-job")
const { ensureCreditsAvailable } = await import("./credits-service")

const USER_UUID = "3f2a1c4e-1b2d-4c3e-8f9a-0b1c2d3e4f5a"
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } })

const payload = {
  userId: USER_UUID,
  userEmail: "me@x.co",
  searchId: "s1",
  listId: "l1",
  searchType: "LOCAL",
  searchParams: {},
  duplicatePolicy: "ONLY_NEW",
}

beforeEach(() => {
  for (const fn of [
    db.jobRun.findUnique, db.searchHistory.findUnique, db.searchHistory.update,
    calls.executeSearch, calls.persist, calls.deduct, calls.markFailed, calls.progress,
  ]) fn.mockReset()
  db.jobRun.findUnique.mockResolvedValue({ id: "job1", payload })
  calls.progress.mockResolvedValue(undefined)
  db.searchHistory.update.mockResolvedValue({})
})
afterEach(() => vi.unstubAllGlobals())

describe("balance pre-check (ensureCreditsAvailable)", () => {
  it("allows zero, refuses negative, fails closed on errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ availableCredits: 0 })))
    expect((await ensureCreditsAvailable(USER_UUID)).ok).toBe(true)
    vi.stubGlobal("fetch", vi.fn(async () => json({ availableCredits: -1 })))
    expect(await ensureCreditsAvailable(USER_UUID)).toMatchObject({ ok: false, status: 402 })
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "nope" }, 401)))
    expect(await ensureCreditsAvailable(USER_UUID)).toMatchObject({ ok: false, status: 503 })
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "down" }, 500)))
    expect(await ensureCreditsAvailable(USER_UUID)).toMatchObject({ ok: false, status: 503 })
    vi.stubGlobal("fetch", vi.fn(async () => json({})))
    expect(await ensureCreditsAvailable(USER_UUID)).toMatchObject({ ok: false, status: 503 })
  })
})

describe("search job billing", () => {
  it("checks the balance before paying the provider", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ availableCredits: -5 })))
    db.searchHistory.findUnique.mockResolvedValue({ status: "PENDING", apifyRunId: null, billableCount: null, resultCount: 0 })
    await expect(processSearchJob("job1")).rejects.toThrow(/negative/)
    expect(calls.executeSearch).not.toHaveBeenCalled()
  })

  it("charges billable saved results with a stable per-job key and records the count with them", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ availableCredits: 10 })))
    db.searchHistory.findUnique.mockResolvedValue({ status: "PENDING", apifyRunId: null, billableCount: null, resultCount: 0 })
    calls.executeSearch.mockResolvedValue([{}, {}, {}])
    calls.persist.mockImplementation(async (args: { billable: (l: unknown[]) => number }) => {
      const leads = [{ email: "a@x.co" }, { email: null }]
      expect(args.billable(leads)).toBe(1)
      return leads
    })
    await processSearchJob("job1")
    expect(calls.deduct).toHaveBeenCalledWith(
      USER_UUID, "search:local", 1,
      expect.objectContaining({ jobRunId: "job1" }), "me@x.co"
    )
  })

  it("a retry after the results were saved charges them without searching again", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    db.searchHistory.findUnique.mockResolvedValue({ status: "COMPLETED", apifyRunId: "run1", billableCount: 4, resultCount: 6 })
    await processSearchJob("job1")
    expect(calls.executeSearch).not.toHaveBeenCalled()
    expect(calls.persist).not.toHaveBeenCalled()
    expect(calls.deduct).toHaveBeenCalledWith(
      USER_UUID, "search:local", 4,
      expect.objectContaining({ jobRunId: "job1" }), "me@x.co"
    )
  })

  it("does not mark a saved search failed when a later step fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ availableCredits: 10 })))
    db.searchHistory.findUnique.mockResolvedValue({ status: "PENDING", apifyRunId: null, billableCount: null, resultCount: 0 })
    calls.executeSearch.mockResolvedValue([{}])
    calls.persist.mockResolvedValue([{ email: "a@x.co" }])
    calls.progress.mockImplementation(async (_id: string, p: { stage?: string }) => {
      if (p.stage === "Recording credit usage") throw new Error("db blip")
    })
    await expect(processSearchJob("job1")).rejects.toThrow("db blip")
    expect(calls.markFailed).not.toHaveBeenCalled()
  })
})
