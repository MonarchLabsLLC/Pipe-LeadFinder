import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { ensureUser } from "@/lib/ensure-user"
import { assertSearchConfigured, executeSearch } from "@/services/search-service"
import {
  markSearchFailed,
  persistSearchResults,
} from "@/services/search-persistence"
import { localSearchSchema } from "@/lib/validators/search"
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
  const parsed = localSearchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { listId, ...searchParams } = parsed.data

  const invalidTarget = await validateSearchTarget(
    session.user.id,
    listId,
    "LOCAL"
  )
  if (invalidTarget) return invalidTarget

  // Check if Apify actor is configured
  try {
    assertSearchConfigured("LOCAL", searchParams)
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Local search is not configured",
        code: "ACTOR_NOT_CONFIGURED",
      },
      { status: 503 }
    )
  }

  const searchHistory = await prisma.searchHistory.create({
    data: {
      userId: session.user.id,
      listId,
      searchType: "LOCAL",
      parameters: JSON.parse(JSON.stringify(searchParams)),
      status: "PENDING",
    },
  })

  try {
    await prisma.searchHistory.update({
      where: { id: searchHistory.id },
      data: { status: "RUNNING" },
    })

    const results = await executeSearch("LOCAL", searchParams as Record<string, unknown>)

    const leads = await persistSearchResults({
      searchId: searchHistory.id,
      listId,
      searchType: "LOCAL",
      results,
    })

    // Local search: only charge for leads with emails found
    const leadsWithEmail = leads.filter((l) => l.email).length
    await deductCredits(session.user.id, "search:local", leadsWithEmail, {
      listId,
      searchType: "LOCAL",
    }, session.user.email)

    return NextResponse.json({
      searchId: searchHistory.id,
      listId,
      status: "COMPLETED",
      resultCount: leads.length,
    })
  } catch (error) {
    await markSearchFailed(searchHistory.id)

    return searchErrorResponse(error, searchHistory.id, "LOCAL")
  }
}
