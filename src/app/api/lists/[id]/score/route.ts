import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { scoreLeadsForList } from "@/services/lead-scoring-service"
import { guardCredits } from "@/lib/credit-guard"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const rawBody = await req.json().catch(() => ({}))
  const body = rawBody && typeof rawBody === "object" ? rawBody : {}
  const requestedLimit = Number((body as Record<string, unknown>).limit)
  const limit =
    Number.isInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 1_000)
      : undefined

  const list = await prisma.leadList.findUnique({
    where: { id },
    select: { id: true, userId: true },
  })

  if (!list) {
    return NextResponse.json({ error: "List not found" }, { status: 404 })
  }

  if (list.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const blocked = await guardCredits(session.user.id, session.user.email)
  if (blocked) return blocked

  const entries = await prisma.leadListEntry.findMany({
    where: { listId: id },
    include: { lead: true },
    take: limit,
    orderBy: { createdAt: "desc" },
  })

  if (entries.length === 0) {
    return NextResponse.json({
      scoredCount: 0,
      leadScores: [],
      message: "This list has no leads to score.",
    })
  }

  try {
    const batches = []
    const leads = entries.map((entry) => entry.lead)
    for (let index = 0; index < leads.length; index += 25) {
      batches.push(leads.slice(index, index + 25))
    }

    const results = []
    for (const batch of batches) {
      results.push(
        await scoreLeadsForList({
          userId: session.user.id,
          email: session.user.email,
          listId: id,
          leads: batch,
        })
      )
    }

    const result = {
      scoredCount: results.reduce((sum, item) => sum + item.scoredCount, 0),
      leadScores: results.flatMap((item) => item.leadScores),
      model: results[0]?.model,
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("[LeadScoring] Failed to score list", {
      listId: id,
      error: error instanceof Error ? error.message : "Unknown error",
    })

    return NextResponse.json(
      {
        error:
          "Lead scoring failed. Check your AI provider configuration and try again.",
      },
      { status: 500 }
    )
  }
}
