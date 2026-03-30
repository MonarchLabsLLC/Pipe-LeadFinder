import { prisma } from "@/lib/prisma"
import { DataSourceType } from "@/generated/prisma/enums"
import Firecrawl from "@mendable/firecrawl-js"

// ---------------------------------------------------------------------------
// Business Profile
// ---------------------------------------------------------------------------

export async function getOrCreateProfile(userId: string) {
  let profile = await prisma.businessProfile.findUnique({
    where: { userId },
    include: { dataSources: { orderBy: { createdAt: "desc" } } },
  })

  if (!profile) {
    profile = await prisma.businessProfile.create({
      data: { userId },
      include: { dataSources: { orderBy: { createdAt: "desc" } } },
    })
  }

  return profile
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
  return prisma.dataSource.findMany({
    where: { profileId },
    orderBy: { createdAt: "desc" },
  })
}

export async function addDataSource(
  profileId: string,
  type: DataSourceType,
  content: string,
  sourceUrl?: string,
  name?: string
) {
  return prisma.dataSource.create({
    data: {
      profileId,
      type,
      content,
      sourceUrl: sourceUrl ?? null,
      name: name ?? null,
    },
  })
}

export async function deleteDataSource(id: string) {
  return prisma.dataSource.delete({ where: { id } })
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

  return combined || "No content extracted."
}

/** Crawl / scrape a single link. */
export async function crawlLink(url: string): Promise<string> {
  const app = getFirecrawl()
  const result = await app.scrape(url, { formats: ["markdown"] })

  return result.markdown ?? "No content extracted."
}
