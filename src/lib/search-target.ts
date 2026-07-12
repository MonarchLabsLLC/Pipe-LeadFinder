import { NextResponse } from "next/server"
import type { SearchType } from "@/generated/prisma/enums"
import { prisma } from "@/lib/prisma"

/** Validate that a search is targeting one of the current user's active lists. */
export async function validateSearchTarget(
  userId: string,
  listId: string,
  searchType: SearchType
): Promise<NextResponse | null> {
  const list = await prisma.leadList.findFirst({
    where: { id: listId, userId },
    select: { type: true, status: true },
  })

  if (!list) {
    return NextResponse.json({ error: "List not found" }, { status: 404 })
  }

  if (list.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "Archived lists cannot receive new search results" },
      { status: 409 }
    )
  }

  if (list.type !== searchType) {
    return NextResponse.json(
      { error: `This search requires a ${searchType.toLowerCase()} list` },
      { status: 409 }
    )
  }

  return null
}
