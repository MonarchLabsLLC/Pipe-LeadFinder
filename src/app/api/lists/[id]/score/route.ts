import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { scoreLeadsForList } from "@/services/lead-scoring-service"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const body = await req.json().catch(() => ({}))
  const limit = Math.min(
    100,
    Math.max(1, Number(body.limit ?? 100) || 100)
  )

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
    const result = await scoreLeadsForList({
      userId: session.user.id,
      email: session.user.email,
      listId: id,
      leads: entries.map((entry) => entry.lead),
    })

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
