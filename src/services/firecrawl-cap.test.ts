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
const prisma = vi.hoisted(() => ({
  $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  $executeRaw: vi.fn(async (_s: TemplateStringsArray, ...values: unknown[]) => {
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

const { reserveFirecrawlPages, FIRECRAWL_DAILY_PAGE_LIMIT, FirecrawlCapError, utcDay } = await import("./firecrawl-cap")
const { crawlWebsite, crawlLink } = await import("./knowledge-base-service")

describe("Firecrawl daily cap", () => {
  beforeEach(() => {
    state.pages = 0
    crawl.mockReset()
    scrape.mockReset()
  })

  it("uses the UTC day", () => {
    expect(utcDay(new Date("2026-11-21T23:30:00-05:00"))).toBe("2026-11-22")
  })

  it("reserves only what is left of the 50-page daily limit", async () => {
    expect(FIRECRAWL_DAILY_PAGE_LIMIT).toBe(50)
    state.pages = 45
    expect(await reserveFirecrawlPages("u1", 10)).toBe(5)
    expect(state.pages).toBe(50)
    expect(await reserveFirecrawlPages("u1", 1)).toBe(0)
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

  it("counts a scrape as one page and a failed crawl as none", async () => {
    scrape.mockResolvedValue({ markdown: "hello" })
    await crawlLink("https://example.com/a", "u1")
    expect(state.pages).toBe(1)
    crawl.mockRejectedValue(new Error("blocked"))
    await expect(crawlWebsite("https://example.com", "u1")).rejects.toThrow("blocked")
    expect(state.pages).toBe(1)
  })
})
