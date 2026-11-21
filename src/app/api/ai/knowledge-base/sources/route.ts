import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import {
  getOrCreateProfile,
  getDataSources,
  addDataSource,
  crawlWebsite,
  crawlLink,
} from "@/services/knowledge-base-service"
import { DataSourceType } from "@/generated/prisma/enums"
import { dataSourceSchema } from "@/lib/validators/knowledge-base"
import { guardCredits } from "@/lib/credit-guard"
import { consumeHitCredits } from "@/services/credits-service"

// GET /api/ai/knowledge-base/sources — list data sources
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const profile = await getOrCreateProfile(session.user.id)
  const sources = await getDataSources(profile.id)
  return NextResponse.json(sources)
}

// POST /api/ai/knowledge-base/sources — add data source
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const profile = await getOrCreateProfile(session.user.id)
  const body = await req.json().catch(() => null)
  const parsed = dataSourceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data source", details: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const { type, content, sourceUrl, name, crawlMode } = parsed.data

  try {
    if (type === DataSourceType.WEBSITE) {
      if (!sourceUrl) {
        return NextResponse.json({ error: "sourceUrl is required for WEBSITE type" }, { status: 400 })
      }

      // Firecrawl is a paid API: refuse only a negative balance, fail closed
      // when the balance cannot be read, then bill every fetched page.
      const blocked = await guardCredits(session.user.id, session.user.email)
      if (blocked) return blocked

      const userId = session.user.id
      const email = session.user.email
      const billPages = async (pages: number) => {
        await consumeHitCredits(
          userId,
          {
            provider: "firecrawl",
            model: "scrape",
            hitCount: pages,
            description: `Lead Finder Knowledge Base ${crawlMode === "link" ? "page scrape" : "website crawl"} (${pages} page${pages === 1 ? "" : "s"})`,
            metadata: { feature: "knowledge-base", crawlMode: crawlMode ?? "website", sourceUrl },
          },
          email
        )
      }

      const extractedContent =
        crawlMode === "link"
          ? await crawlLink(sourceUrl, billPages)
          : await crawlWebsite(sourceUrl, billPages)

      const source = await addDataSource(
        profile.id,
        DataSourceType.WEBSITE,
        extractedContent,
        sourceUrl,
        name ?? sourceUrl
      )
      return NextResponse.json(source, { status: 201 })
    }

    // TEXT and Q&A sources store user-supplied context directly. PDFs use the
    // dedicated upload route so file validation and private storage are applied.
    if (!content) {
      return NextResponse.json({ error: "content is required" }, { status: 400 })
    }

    const source = await addDataSource(profile.id, type, content, sourceUrl, name)
    return NextResponse.json(source, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add data source"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
