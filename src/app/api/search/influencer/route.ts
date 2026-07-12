import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { ensureUser } from "@/lib/ensure-user"
import { assertSearchConfigured, executeSearch } from "@/services/search-service"
import {
  markSearchFailed,
  persistSearchResults,
} from "@/services/search-persistence"
import { influencerSearchSchema } from "@/lib/validators/search"
import { guardCredits, deductCredits } from "@/lib/credit-guard"
import { searchErrorResponse } from "@/lib/search-error-response"
import { validateSearchTarget } from "@/lib/search-target"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  await ensureUser(session)

  const blocked = await guardCredits(session.user.id, session.user.email)
  if (blocked) return blocked

  const body = await req.json().catch(() => null)
  const parsed = influencerSearchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { listId, ...searchParams } = parsed.data

  const invalidTarget = await validateSearchTarget(
    session.user.id,
    listId,
    "INFLUENCER"
  )
  if (invalidTarget) return invalidTarget

  // Check if Apify actor is configured
  try {
    assertSearchConfigured("INFLUENCER", searchParams)
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Influencer search is not configured",
        code: "ACTOR_NOT_CONFIGURED",
      },
      { status: 503 }
    )
  }

  const searchHistory = await prisma.searchHistory.create({
    data: {
      userId: session.user.id,
      listId,
      searchType: "INFLUENCER",
      parameters: JSON.parse(JSON.stringify(searchParams)),
      status: "PENDING",
    },
  })

  try {
    await prisma.searchHistory.update({
      where: { id: searchHistory.id },
      data: { status: "RUNNING" },
    })

    const results = await executeSearch("INFLUENCER", searchParams as Record<string, unknown>)

    const leads = await persistSearchResults({
      searchId: searchHistory.id,
      listId,
      searchType: "INFLUENCER",
      results,
    })

    await deductCredits(session.user.id, "search:influencer", leads.length, {
      listId,
      searchType: "INFLUENCER",
    }, session.user.email)

    return NextResponse.json({
      searchId: searchHistory.id,
      listId,
      status: "COMPLETED",
      resultCount: leads.length,
    })
  } catch (error) {
    await markSearchFailed(searchHistory.id)

    return searchErrorResponse(error, searchHistory.id, "INFLUENCER")
  }
}
