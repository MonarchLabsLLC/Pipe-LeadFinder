/**
 * Knowledge Base Firecrawl crawls are free for customers but capped at
 * FIRECRAWL_DAILY_PAGE_LIMIT pages per user per UTC day. Pages are reserved
 * before a crawl (so concurrent crawls cannot overshoot) and unused pages are
 * returned once the crawl reports how many it fetched.
 */
import { prisma } from "@/lib/prisma"

export const FIRECRAWL_DAILY_PAGE_LIMIT = 50

export const FIRECRAWL_CAP_MESSAGE = `You've reached today's limit of ${FIRECRAWL_DAILY_PAGE_LIMIT} website pages for the Knowledge Base. Please try again tomorrow.`

export class FirecrawlCapError extends Error {
  status = 429
  constructor() {
    super(FIRECRAWL_CAP_MESSAGE)
    this.name = "FirecrawlCapError"
  }
}

export function utcDay(now = new Date()) {
  return now.toISOString().slice(0, 10)
}

/** Reserve up to `wanted` pages for today. Returns how many were reserved (0 = cap reached). */
export async function reserveFirecrawlPages(userId: string, wanted: number, now = new Date()) {
  const day = utcDay(now)
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`INSERT INTO "FirecrawlUsage" ("userId", "day", "pages", "updatedAt")
      VALUES (${userId}, ${day}, 0, now()) ON CONFLICT ("userId", "day") DO NOTHING`
    const rows = await tx.$queryRaw<Array<{ pages: number }>>`SELECT "pages" FROM "FirecrawlUsage"
      WHERE "userId" = ${userId} AND "day" = ${day} FOR UPDATE`
    const used = Number(rows[0]?.pages ?? 0)
    const reserved = Math.max(0, Math.min(wanted, FIRECRAWL_DAILY_PAGE_LIMIT - used))
    if (reserved > 0) {
      await tx.$executeRaw`UPDATE "FirecrawlUsage" SET "pages" = "pages" + ${reserved}, "updatedAt" = now()
        WHERE "userId" = ${userId} AND "day" = ${day}`
    }
    return reserved
  })
}

/** Return reserved pages that the crawl did not use. */
export async function releaseFirecrawlPages(userId: string, pages: number, now = new Date()) {
  if (pages <= 0) return
  const day = utcDay(now)
  await prisma.$executeRaw`UPDATE "FirecrawlUsage" SET "pages" = GREATEST(0, "pages" - ${pages}), "updatedAt" = now()
    WHERE "userId" = ${userId} AND "day" = ${day}`
}
