import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { enrichBulk } from "@/services/enrich-service"

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

  try {
    const result = await enrichBulk(listId)
    return NextResponse.json(result)
  } catch (error) {
    console.error("Bulk enrichment failed:", error)
    return NextResponse.json(
      { error: "Bulk enrichment failed" },
      { status: 500 }
    )
  }
}
