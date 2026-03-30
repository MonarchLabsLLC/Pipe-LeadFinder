import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { enrichBulk } from "@/services/enrich-service"
import { guardCredits, deductCredits } from "@/lib/credit-guard"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { listId } = body as { listId?: string }

  if (!listId || typeof listId !== "string") {
    return NextResponse.json(
      { error: "listId is required" },
      { status: 400 }
    )
  }

  // Verify list exists and belongs to the authenticated user
  const list = await prisma.leadList.findUnique({ where: { id: listId } })
  if (!list) {
    return NextResponse.json({ error: "List not found" }, { status: 404 })
  }
  if (list.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const blocked = await guardCredits(session.user.id, session.user.email)
  if (blocked) return blocked

  try {
    const result = await enrichBulk(listId)

    // Charge per lead that was actually enriched
    if (result.enriched > 0) {
      deductCredits(session.user.id, "enrich:email", result.enriched, {
        listId,
      })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Bulk enrichment failed:", error)
    return NextResponse.json(
      { error: "Bulk enrichment failed" },
      { status: 500 }
    )
  }
}
