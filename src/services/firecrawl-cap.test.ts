import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ pages: 0 }))
const tx = vi.hoisted(() => ({
  $executeRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const sql = strings.join("?")
    if (sql.includes("UPDATE")) state.pages += Number(values[0])
    return 1
  }),
  $queryRaw: vi.fn(async () => [{ pages: state.pages }]),
}))
const released = vi.hoisted(() => [] as Array<{ pages: number; day: unknown }>)
const prisma = vi.hoisted(() => ({
  $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  $executeRaw: vi.fn(async (_s: TemplateStringsArray, ...values: unknown[]) => {
    released.push({ pages: Number(values[0]), day: values[2] })
    state.pages = Math.max(0, state.pages - Number(values[0]))
    return 1
  }),
}))
vi.mock("@/lib/prisma", () => ({ prisma }))

const crawl = vi.fn()
const scrape = vi.fn()
vi.mock("@/lib/safe-url", () => ({ assertSafePublicUrl: vi.fn(async () => {}) }))
vi.mock("@mendable/firecrawl-js", () => ({
  default: class {
    crawl = crawl
    scrape = scrape
  },
}))
process.env.FIRECRAWL_API_KEY = "test-placeholder"

const {
  reserveFirecrawlPages,
  releaseFirecrawlPages,
  isPreWorkFirecrawlFailure,
  FIRECRAWL_DAILY_PAGE_LIMIT,
  FirecrawlCapError,
  utcDay,
} = await import("./firecrawl-cap")
const { crawlWebsite, crawlLink } = await import("./knowledge-base-service")

describe("Firecrawl daily cap", () => {
  beforeEach(() => {
    state.pages = 0
    released.length = 0
    crawl.mockReset()
    scrape.mockReset()
  })

  it("uses the UTC day", () => {
    expect(utcDay(new Date("2026-11-21T23:30:00-05:00"))).toBe("2026-11-22")
  })

  it("reserves only what is left of the 50-page daily limit", async () => {
    expect(FIRECRAWL_DAILY_PAGE_LIMIT).toBe(50)
    state.pages = 45
    expect(await reserveFirecrawlPages("u1", 10, new Date("2026-11-21T12:00:00Z"))).toEqual({ reserved: 5, day: "2026-11-21" })
    expect(state.pages).toBe(50)
    expect((await reserveFirecrawlPages("u1", 1)).reserved).toBe(0)
  })

  it("limits the crawl to the remaining pages and gives back unused ones", async () => {
    state.pages = 44
    crawl.mockResolvedValue({ completed: 2, data: [{ markdown: "a" }, { markdown: "b" }] })
    await crawlWebsite("https://example.com", "u1")
    expect(crawl.mock.calls[0][1].limit).toBe(6)
    expect(state.pages).toBe(46)
  })

  it("refuses over the cap without calling Firecrawl", async () => {
    state.pages = 50
    await expect(crawlLink("https://example.com/a", "u1")).rejects.toBeInstanceOf(FirecrawlCapError)
    await expect(crawlWebsite("https://example.com", "u1")).rejects.toThrow(/limit of 50/)
    expect(scrape).not.toHaveBeenCalled()
    expect(crawl).not.toHaveBeenCalled()
  })

  it("counts a scrape as one page", async () => {
    scrape.mockResolvedValue({ markdown: "hello" })
    await crawlLink("https://example.com/a", "u1")
    expect(state.pages).toBe(1)
  })

  it("refunds a crawl Firecrawl rejected before doing any work", async () => {
    crawl.mockRejectedValue(Object.assign(new Error("Bad request"), { status: 400 }))
    await expect(crawlWebsite("https://example.com", "u1")).rejects.toThrow("Bad request")
    expect(state.pages).toBe(0)
    crawl.mockRejectedValue(Object.assign(new Error("connect"), { code: "ECONNREFUSED" }))
    await expect(crawlWebsite("https://example.com", "u1")).rejects.toThrow("connect")
    expect(state.pages).toBe(0)
  })

  it("counts a 403 or 408 from Firecrawl against the cap", async () => {
    crawl.mockRejectedValue(Object.assign(new Error("Forbidden by site"), { status: 403 }))
    await expect(crawlWebsite("https://example.com", "u1")).rejects.toThrow("Forbidden")
    expect(state.pages).toBe(10)
    scrape.mockRejectedValue(Object.assign(new Error("Request timeout"), { status: 408 }))
    await expect(crawlLink("https://example.com/a", "u1")).rejects.toThrow("timeout")
    expect(state.pages).toBe(11)
  })

  it("keeps the reservation counted when Firecrawl may have fetched pages", async () => {
    crawl.mockRejectedValue(Object.assign(new Error("Job timed out"), { name: "JobTimeoutError", jobId: "j1" }))
    await expect(crawlWebsite("https://example.com", "u1")).rejects.toThrow("timed out")
    expect(state.pages).toBe(10)
    crawl.mockRejectedValue(Object.assign(new Error("upstream"), { status: 502 }))
    await expect(crawlWebsite("https://example.com", "u1")).rejects.toThrow("upstream")
    expect(state.pages).toBe(20)
    crawl.mockRejectedValue(new Error("socket hang up"))
    await expect(crawlWebsite("https://example.com", "u1")).rejects.toThrow("socket")
    expect(state.pages).toBe(30)
  })

  it("classifies failures conservatively", () => {
    for (const status of [400, 401, 402, 422])
      expect(isPreWorkFirecrawlFailure({ status })).toBe(true)
    for (const status of [403, 404, 408, 409, 429])
      expect(isPreWorkFirecrawlFailure({ status })).toBe(false)
    expect(isPreWorkFirecrawlFailure({ status: 404, jobId: "j1" })).toBe(false)
    expect(isPreWorkFirecrawlFailure({ status: 500 })).toBe(false)
    expect(isPreWorkFirecrawlFailure({ code: "ENOTFOUND" })).toBe(true)
    expect(isPreWorkFirecrawlFailure({ code: "ETIMEDOUT" })).toBe(false)
    expect(isPreWorkFirecrawlFailure(new Error("?"))).toBe(false)
  })

  it("releases unused pages on the day they were reserved, even after midnight", async () => {
    state.pages = 0
    const { reserved, day } = await reserveFirecrawlPages("u1", 10, new Date("2026-11-21T23:59:50Z"))
    await releaseFirecrawlPages("u1", reserved - 3, day)
    expect(released.at(-1)).toEqual({ pages: 7, day: "2026-11-21" })
  })
})
