import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { resolveWorkspaceScope } from "@/lib/scale-workspace/guest"
import { prisma } from "@/lib/prisma"

const RECENT_SEARCH_LIMIT = 6

/**
 * GET /api/search/recent — the last searches of the current tenant that still
 * have an active list, newest first, for "Pick up where you left off".
 * Guests read the bound owner's searches; "Run again" is owner-only because
 * the rerun route is not open to guests.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const scope = await resolveWorkspaceScope(session, {
    method: "GET",
    path: "/api/search/recent",
  })
  if (!scope.ok) return scope.response

  const searches = await prisma.searchHistory.findMany({
    where: { userId: scope.tenantUserId, list: { status: "ACTIVE" } },
    orderBy: { createdAt: "desc" },
    take: RECENT_SEARCH_LIMIT,
    select: {
      id: true,
      searchType: true,
      parameters: true,
      resultCount: true,
      status: true,
      createdAt: true,
      list: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json({ searches, canRerun: !scope.isGuest })
}
