import { prisma } from "@/lib/prisma"
import { DataSourceType } from "@/generated/prisma/enums"
import Firecrawl from "@mendable/firecrawl-js"
import { assertSafePublicUrl } from "@/lib/safe-url"

const MAX_STORED_SOURCE_CHARS = 500_000

// ---------------------------------------------------------------------------
// Business Profile
// ---------------------------------------------------------------------------

export async function getOrCreateProfile(userId: string) {
  return prisma.businessProfile.upsert({
    where: { userId },
    update: {},
    create: { userId },
  })
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

/** Crawl an entire website (may return multiple pages). */
export async function crawlWebsite(url: string): Promise<string> {
  await assertSafePublicUrl(url)
  const app = getFirecrawl()
  const result = await app.crawl(url, {
    limit: 10,
    scrapeOptions: { formats: ["markdown"] },
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

/** Crawl / scrape a single link. */
export async function crawlLink(url: string): Promise<string> {
  await assertSafePublicUrl(url)
  const app = getFirecrawl()
  const result = await app.scrape(url, { formats: ["markdown"] })

  if (!result.markdown?.trim()) {
    throw new Error("No readable content was extracted from this page")
  }
  return result.markdown
}
