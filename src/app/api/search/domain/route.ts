import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { ensureUser } from "@/lib/ensure-user"
import { pickLeadFields } from "@/lib/pick-lead-fields"
import { executeSearch } from "@/services/search-service"
import { domainSearchSchema } from "@/lib/validators/search"
import { guardCredits, deductCredits } from "@/lib/credit-guard"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  await ensureUser(session)

  const blocked = await guardCredits(session.user.id, session.user.email)
  if (blocked) return blocked

  const body = await req.json()
  const parsed = domainSearchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { listId, ...searchParams } = parsed.data

  // Check if Apify actor is configured
  if (!process.env.APIFY_ACTOR_DOMAIN) {
    return NextResponse.json(
      {
        error: "Domain search is not configured yet. Set APIFY_ACTOR_DOMAIN in your .env file.",
        code: "ACTOR_NOT_CONFIGURED",
      },
      { status: 503 }
    )
  }

  const searchHistory = await prisma.searchHistory.create({
    data: {
      userId: session.user.id,
      listId: listId || null,
      searchType: "DOMAIN",
      parameters: JSON.parse(JSON.stringify(searchParams)),
      status: "PENDING",
    },
  })

  try {
    await prisma.searchHistory.update({
      where: { id: searchHistory.id },
      data: { status: "RUNNING" },
    })

    const results = await executeSearch("DOMAIN", searchParams as Record<string, unknown>)

    const leads = await Promise.all(
      results.map(async (leadData) => {
        const lead = await prisma.lead.create({
          data: {
            ...pickLeadFields(leadData),
            sourceType: "DOMAIN",
            emailStatus: leadData.email ? "FOUND" : "NOT_FOUND",
          },
        })

        if (listId) {
          await prisma.leadListEntry.create({
            data: { listId, leadId: lead.id },
          }).catch(() => {}) // Ignore duplicate entries
        }

        return lead
      })
    )

    await prisma.searchHistory.update({
      where: { id: searchHistory.id },
      data: { status: "COMPLETED", resultCount: leads.length },
    })

    deductCredits(session.user.id, "search:domain", leads.length, {
      listId: listId || undefined,
      searchType: "DOMAIN",
    })

    return NextResponse.json({
      searchId: searchHistory.id,
      listId: listId || null,
      status: "COMPLETED",
      resultCount: leads.length,
      results: leads,
    })
  } catch (error) {
    await prisma.searchHistory.update({
      where: { id: searchHistory.id },
      data: { status: "FAILED" },
    })

    const message =
      error instanceof Error ? error.message : "Search failed"

    return NextResponse.json(
      { error: message, searchId: searchHistory.id },
      { status: 500 }
    )
  }
}
