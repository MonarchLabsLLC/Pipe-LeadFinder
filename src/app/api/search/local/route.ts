import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { ensureUser } from "@/lib/ensure-user"
import { pickLeadFields } from "@/lib/pick-lead-fields"
import { executeSearch } from "@/services/search-service"
import { localSearchSchema } from "@/lib/validators/search"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  await ensureUser(session)

  const body = await req.json()
  const parsed = localSearchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { listId, ...searchParams } = parsed.data

  // Check if Apify actor is configured
  if (!process.env.APIFY_ACTOR_LOCAL) {
    return NextResponse.json(
      {
        error: "Local search is not configured yet. Set APIFY_ACTOR_LOCAL in your .env file.",
        code: "ACTOR_NOT_CONFIGURED",
      },
      { status: 503 }
    )
  }

  const searchHistory = await prisma.searchHistory.create({
    data: {
      userId: session.user.id,
      listId: listId || null,
      searchType: "LOCAL",
      parameters: searchParams as Record<string, unknown>,
      status: "PENDING",
    },
  })

  try {
    await prisma.searchHistory.update({
      where: { id: searchHistory.id },
      data: { status: "RUNNING" },
    })

    const results = await executeSearch("LOCAL", searchParams as Record<string, unknown>)

    const leads = await Promise.all(
      results.map(async (leadData) => {
        const lead = await prisma.lead.create({
          data: {
            ...pickLeadFields(leadData),
            sourceType: "LOCAL",
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
