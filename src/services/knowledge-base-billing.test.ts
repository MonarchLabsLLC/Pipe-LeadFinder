import { describe, expect, it, vi } from "vitest"

const crawl = vi.fn()
const scrape = vi.fn()
vi.mock("@/lib/prisma", () => ({ prisma: {} }))
vi.mock("@/lib/safe-url", () => ({ assertSafePublicUrl: vi.fn(async () => {}) }))
vi.mock("@mendable/firecrawl-js", () => ({
  default: class {
    crawl = crawl
    scrape = scrape
  },
}))

process.env.FIRECRAWL_API_KEY = "test-placeholder"
const { crawlWebsite, crawlLink, crawledPageCount } = await import("./knowledge-base-service")

describe("Firecrawl billing", () => {
  it("bills every crawled page before rejecting empty content", async () => {
    crawl.mockResolvedValue({ completed: 4, data: [{ markdown: " " }] })
    const bill = vi.fn(async () => {})
    await expect(crawlWebsite("https://example.com", bill)).rejects.toThrow(/No readable content/)
    expect(bill).toHaveBeenCalledWith(4)
  })

  it("bills a single scrape even when it has no markdown", async () => {
    scrape.mockResolvedValue({ markdown: "" })
    const bill = vi.fn(async () => {})
    await expect(crawlLink("https://example.com/a", bill)).rejects.toThrow(/No readable content/)
    expect(bill).toHaveBeenCalledWith(1)
  })

  it("counts pages from the job or its data", () => {
    expect(crawledPageCount({ completed: 3, data: [1, 2] })).toBe(3)
    expect(crawledPageCount({ data: [1, 2] })).toBe(2)
    expect(crawledPageCount({})).toBe(0)
  })
})
