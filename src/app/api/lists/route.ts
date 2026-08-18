import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { resolveWorkspaceScope } from "@/lib/scale-workspace/guest"
import { prisma } from "@/lib/prisma"
import { ensureUser } from "@/lib/ensure-user"
import { createListSchema, listQuerySchema } from "@/lib/validators/list"

// GET /api/lists — returns all lists for current user with lead counts
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const scope = await resolveWorkspaceScope(session, {
    method: "GET",
    path: "/api/lists",
  })
  if (!scope.ok) {
    return scope.response
  }
  await ensureUser(session)

  const { searchParams } = req.nextUrl
  const parsedQuery = listQuerySchema.safeParse({
    type: searchParams.get("type") || undefined,
    status: searchParams.get("status") || undefined,
  })

  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: "Invalid list filters", details: parsedQuery.error.flatten() },
      { status: 400 }
    )
  }

  const { type, status } = parsedQuery.data

  const where: Record<string, unknown> = { userId: scope.tenantUserId }
  if (type) where.type = type
  if (status) where.status = status

  const lists = await prisma.leadList.findMany({
    where,
    include: {
      _count: {
        select: { leads: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  const foundEntries = lists.length
    ? await prisma.leadListEntry.groupBy({
        by: ["listId"],
        where: {
          listId: { in: lists.map((list) => list.id) },
          lead: { emailStatus: "FOUND" },
        },
        _count: { _all: true },
      })
    : []
  const foundCounts = new Map(
    foundEntries.map((entry) => [entry.listId, entry._count._all])
  )

  const result = lists.map((list) => {
    return {
      id: list.id,
      name: list.name,
      type: list.type,
      status: list.status,
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
      leadCount: list._count.leads,
      emailFoundCount: foundCounts.get(list.id) ?? 0,
    }
  })

  return NextResponse.json(result)
}

// POST /api/lists — create new list
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const scope = await resolveWorkspaceScope(session, {
    method: "POST",
    path: "/api/lists",
  })
  if (!scope.ok) {
    return scope.response
  }
  await ensureUser(session)

  const body = await req.json().catch(() => null)
  const parsed = createListSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const list = await prisma.leadList.create({
    data: {
      name: parsed.data.name,
      type: parsed.data.type,
      userId: scope.tenantUserId,
    },
  })

  return NextResponse.json(list, { status: 201 })
}
