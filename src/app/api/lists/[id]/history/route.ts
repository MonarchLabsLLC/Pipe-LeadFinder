import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { resolveWorkspaceScope } from "@/lib/scale-workspace/guest"
import { prisma } from "@/lib/prisma"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const scope = await resolveWorkspaceScope(session, {
    method: "GET",
    path: "/api/lists/[id]/history",
  })
  if (!scope.ok) {
    return scope.response
  }

  const { id: listId } = await params

  const history = await prisma.searchHistory.findMany({
    where: { listId, userId: scope.tenantUserId },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return NextResponse.json(history)
}
