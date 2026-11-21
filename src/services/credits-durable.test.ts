import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const upsert = vi.fn()
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() }, pendingCreditCharge: { upsert } },
}))

const {
  classifyConsumeFailure,
  consumeCredits,
  consumeHitCredits,
  consumeTokenCredits,
} = await import("./credits-service")

const USER_UUID = "3f2a1c4e-1b2d-4c3e-8f9a-0b1c2d3e4f5a"
const tokens = {
  provider: "openrouter" as const,
  model: "deepseek/deepseek-v4.1-flash",
  inputTokens: 100,
  outputTokens: 50,
}
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } })

beforeEach(() => {
  upsert.mockReset()
  upsert.mockResolvedValue({})
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe("durable Micro charges", () => {
  it("classifies failures", () => {
    expect(classifyConsumeFailure(409)).toBe("owed")
    expect(classifyConsumeFailure(null)).toBe("retryable")
    expect(classifyConsumeFailure(503)).toBe("retryable")
    expect(classifyConsumeFailure(401)).toBe("retryable")
    expect(classifyConsumeFailure(400)).toBe("rejected")
  })

  it("always sends an idempotency key for token charges", async () => {
    const fetchMock = vi.fn(async () => json({ debited: 2, availableCredits: 8 }))
    vi.stubGlobal("fetch", fetchMock)
    const result = await consumeTokenCredits(USER_UUID, tokens, "me@x.co")
    expect(result).toMatchObject({ success: true, debited: 2 })
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body))
    expect(body.idempotencyKey).toMatch(/^PipeLeads:/)
    expect(upsert).not.toHaveBeenCalled()
  })

  it("queues a charge with its key when Micro answers 5xx", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "down" }, 503)))
    const result = await consumeTokenCredits(USER_UUID, { ...tokens, idempotencyKey: "k-1" }, "me@x.co")
    expect(result).toMatchObject({ success: true, queued: true, owed: false })
    expect(upsert).toHaveBeenCalledTimes(1)
    const arg = upsert.mock.calls[0][0]
    expect(arg.where).toEqual({ idempotencyKey: "k-1" })
    expect(arg.create).toMatchObject({ status: "pending", creditUserId: USER_UUID, email: "me@x.co" })
    expect(arg.create.payload).toMatchObject({ model: tokens.model, inputTokens: 100, idempotencyKey: "k-1" })
  })

  it("records a 409 as owed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "Insufficient credits" }, 409)))
    const result = await consumeCredits(USER_UUID, { amount: 25, description: "x", metadata: { action: "search:local", resultCount: 1 } })
    expect(result).toMatchObject({ success: true, owed: true })
    expect(upsert.mock.calls[0][0].create.status).toBe("owed")
    expect(upsert.mock.calls[0][0].create.idempotencyKey).toMatch(/^PipeLeads:/)
  })

  it("reports a permanent rejection as a failure but still records it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "Validation failed" }, 400)))
    const result = await consumeTokenCredits(USER_UUID, tokens)
    expect(result?.success).toBe(false)
    expect(upsert.mock.calls[0][0].create.status).toBe("failed")
  })

  it("queues network failures after retries", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] })
    try {
      vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNREFUSED") }))
      const pending = consumeTokenCredits(USER_UUID, tokens)
      await vi.runAllTimersAsync()
      expect(await pending).toMatchObject({ success: true, queued: true })
      expect(upsert.mock.calls[0][0].create.status).toBe("pending")
    } finally {
      vi.useRealTimers()
    }
  })

  it("bills Firecrawl per page with Micro's existing SKU", async () => {
    const fetchMock = vi.fn(async () => json({ debited: 1, availableCredits: 9 }))
    vi.stubGlobal("fetch", fetchMock)
    await consumeHitCredits(USER_UUID, { provider: "firecrawl", model: "scrape", hitCount: 7, description: "crawl" })
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body))
    expect(body).toMatchObject({ provider: "firecrawl", model: "scrape", hitCount: 7, appName: "PipeLeads" })
    expect(body.idempotencyKey).toMatch(/^PipeLeads:/)
  })

  it("skips empty usage", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    expect(await consumeHitCredits(USER_UUID, { provider: "firecrawl", model: "scrape", hitCount: 0, description: "x" })).toBeNull()
    expect(await consumeTokenCredits(USER_UUID, { ...tokens, inputTokens: 0, outputTokens: 0 })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
