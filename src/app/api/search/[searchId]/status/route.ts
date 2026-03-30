import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ searchId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchId } = await params

  const search = await prisma.searchHistory.findUnique({
    where: { id: searchId },
  })

  if (!search) {
    return NextResponse.json({ error: "Search not found" }, { status: 404 })
  }

  if (search.userId !== session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  return NextResponse.json({
    searchId: search.id,
    status: search.status,
    resultCount: search.resultCount,
  })
}
