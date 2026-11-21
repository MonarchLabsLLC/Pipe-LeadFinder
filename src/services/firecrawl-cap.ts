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

export type FirecrawlReservation = { reserved: number; day: string }

/**
 * Reserve up to `wanted` pages for today. Returns how many were reserved
 * (0 = cap reached) and the UTC day they were reserved against, which must be
 * passed back to releaseFirecrawlPages (a crawl may span midnight).
 */
export async function reserveFirecrawlPages(
  userId: string,
  wanted: number,
  now = new Date()
): Promise<FirecrawlReservation> {
  const day = utcDay(now)
  const reserved = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`INSERT INTO "FirecrawlUsage" ("userId", "day", "pages", "updatedAt")
      VALUES (${userId}, ${day}, 0, now()) ON CONFLICT ("userId", "day") DO NOTHING`
    const rows = await tx.$queryRaw<Array<{ pages: number }>>`SELECT "pages" FROM "FirecrawlUsage"
      WHERE "userId" = ${userId} AND "day" = ${day} FOR UPDATE`
    const used = Number(rows[0]?.pages ?? 0)
    const granted = Math.max(0, Math.min(wanted, FIRECRAWL_DAILY_PAGE_LIMIT - used))
    if (granted > 0) {
      await tx.$executeRaw`UPDATE "FirecrawlUsage" SET "pages" = "pages" + ${granted}, "updatedAt" = now()
        WHERE "userId" = ${userId} AND "day" = ${day}`
    }
    return granted
  })
  return { reserved, day }
}

/** Return reserved pages the crawl did not use, on the day they were reserved. */
export async function releaseFirecrawlPages(userId: string, pages: number, day: string) {
  if (pages <= 0) return
  await prisma.$executeRaw`UPDATE "FirecrawlUsage" SET "pages" = GREATEST(0, "pages" - ${pages}), "updatedAt" = now()
    WHERE "userId" = ${userId} AND "day" = ${day}`
}

const PRE_SEND_NETWORK_CODES = new Set(["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN"])

/**
 * True only when a Firecrawl call clearly failed before Firecrawl did any
 * work: a 4xx rejection of the request itself (no job was created), or a
 * connection that could not be opened. Timeouts, 5xx, failed jobs and
 * anything unknown may have fetched pages and are counted.
 */
export function isPreWorkFirecrawlFailure(error: unknown) {
  if (!error || typeof error !== "object") return false
  const e = error as { status?: unknown; code?: unknown; jobId?: unknown; name?: unknown }
  if (e.name === "JobTimeoutError" || e.jobId) return false
  if (typeof e.status === "number") return e.status >= 400 && e.status < 500
  return typeof e.code === "string" && PRE_SEND_NETWORK_CODES.has(e.code)
}
