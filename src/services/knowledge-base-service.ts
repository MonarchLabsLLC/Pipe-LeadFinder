import { prisma } from "@/lib/prisma"
import { DataSourceType } from "@/generated/prisma/enums"
import Firecrawl from "@mendable/firecrawl-js"
import { assertSafePublicUrl } from "@/lib/safe-url"
import {
  FirecrawlCapError,
  releaseFirecrawlPages,
  reserveFirecrawlPages,
} from "@/services/firecrawl-cap"

const MAX_STORED_SOURCE_CHARS = 500_000

// ---------------------------------------------------------------------------
// Business Profile
// ---------------------------------------------------------------------------

export async function getOrCreateProfile(userId: string) {
  try {
    return await prisma.businessProfile.upsert({
      where: { userId },
      update: {},
      create: { userId },
    })
  } catch (error) {
    // The Knowledge Base page loads the profile and its sources in parallel,
    // and both create the profile on a first visit. The losing insert hits the
    // unique userId; the row it collided with is the one we want.
    if ((error as { code?: string }).code !== "P2002") throw error
    return prisma.businessProfile.findUniqueOrThrow({ where: { userId } })
  }
}

export async function updateProfile(
  userId: string,
  data: {
    businessName?: string
    businessWebsite?: string
    whatYouSell?: string
    whoItHelps?: string
    whatItDoes?: string
    contactPerson?: string
    personality?: string
  }
) {
  return prisma.businessProfile.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  })
}

// ---------------------------------------------------------------------------
// Data Sources
// ---------------------------------------------------------------------------

export async function getDataSources(profileId: string) {
  const sources = await prisma.dataSource.findMany({
    where: { profileId },
    orderBy: { createdAt: "desc" },
  })
  return sources.map((source) => ({
    ...source,
    content: source.content.slice(0, 2_000),
  }))
}

export async function addDataSource(
  profileId: string,
  type: DataSourceType,
  content: string,
  sourceUrl?: string,
  name?: string
) {
  const storedContent =
    content.length > MAX_STORED_SOURCE_CHARS
      ? `${content.slice(0, MAX_STORED_SOURCE_CHARS)}\n\n[Source truncated for storage safety.]`
      : content
  return prisma.dataSource.create({
    data: {
      profileId,
      type,
      content: storedContent,
      sourceUrl: sourceUrl ?? null,
      name: name ?? null,
    },
  })
}

// ---------------------------------------------------------------------------
// Firecrawl helpers
// ---------------------------------------------------------------------------

function getFirecrawl() {
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY is not configured")
  return new Firecrawl({ apiKey })
}

const MAX_CRAWL_PAGES = 10

/** Pages a finished Firecrawl crawl job fetched (what counts toward the daily cap). */
export function crawledPageCount(result: { completed?: number; data?: unknown[] }) {
  const completed = typeof result.completed === "number" ? result.completed : 0
  return Math.max(completed, result.data?.length ?? 0)
}

/**
 * Reserve pages under the per-user daily cap, run the crawl, and give back
 * what it did not use. Throws FirecrawlCapError (429) when the cap is reached.
 */
async function withFirecrawlCap<T>(
  userId: string | undefined,
  wanted: number,
  run: (limit: number) => Promise<{ value: T; pages: number }>
): Promise<T> {
  if (!userId) return (await run(wanted)).value
  const reserved = await reserveFirecrawlPages(userId, wanted)
  if (reserved <= 0) throw new FirecrawlCapError()
  let used = reserved
  try {
    const { value, pages } = await run(reserved)
    used = Math.min(reserved, Math.max(0, pages))
    return value
  } catch (error) {
    // A crawl that failed before returning a page count is not counted.
    used = 0
    throw error
  } finally {
    await releaseFirecrawlPages(userId, reserved - used).catch((error) => {
      console.error("[Firecrawl] Failed to release unused cap pages:", (error as Error).message)
    })
  }
}

/** Crawl an entire website (may return multiple pages). Pass userId to apply the daily cap. */
export async function crawlWebsite(url: string, userId?: string): Promise<string> {
  await assertSafePublicUrl(url)
  const app = getFirecrawl()
  const result = await withFirecrawlCap(userId, MAX_CRAWL_PAGES, async (limit) => {
    const crawl = await app.crawl(url, {
      limit,
      scrapeOptions: { formats: ["markdown"] },
    })
    return { value: crawl, pages: crawledPageCount(crawl) }
  })

  const pages = result.data ?? []
  const combined = pages
    .map((p) => {
      const heading = p.metadata?.sourceURL ? `## ${p.metadata.sourceURL}\n` : ""
      return heading + (p.markdown ?? "")
    })
    .join("\n\n---\n\n")

  if (!combined.trim()) throw new Error("No readable content was extracted from this website")
  return combined
}

/** Crawl / scrape a single link. Pass userId to apply the daily cap. */
export async function crawlLink(url: string, userId?: string): Promise<string> {
  await assertSafePublicUrl(url)
  const app = getFirecrawl()
  const result = await withFirecrawlCap(userId, 1, async () => ({
    value: await app.scrape(url, { formats: ["markdown"] }),
    pages: 1,
  }))

  if (!result.markdown?.trim()) {
    throw new Error("No readable content was extracted from this page")
  }
  return result.markdown
}
