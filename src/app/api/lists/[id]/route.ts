import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { updateListSchema } from "@/lib/validators/list"

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/lists/[id] — get list with paginated leads
export async function GET(req: NextRequest, context: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const { searchParams } = req.nextUrl
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25")))
  const emailFilter = searchParams.get("emailFilter")

  const list = await prisma.leadList.findUnique({
    where: { id },
  })

  if (!list) {
    return NextResponse.json({ error: "List not found" }, { status: 404 })
  }

  if (list.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const leadWhere: Record<string, unknown> = { listId: id }
  if (emailFilter) {
    leadWhere.lead = { emailStatus: emailFilter }
  }

  const [entries, total] = await Promise.all([
    prisma.leadListEntry.findMany({
      where: leadWhere,
      include: {
        lead: true,
        labels: {
          include: { label: true },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.leadListEntry.count({ where: leadWhere }),
  ])

  return NextResponse.json({
    list: {
      id: list.id,
      name: list.name,
      type: list.type,
      status: list.status,
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    leads: entries.map((entry: any) => ({
      entryId: entry.id,
      ...entry.lead,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      labels: entry.labels.map((l: any) => l.label),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}

// PATCH /api/lists/[id] — update list (rename, archive)
export async function PATCH(req: NextRequest, context: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const list = await prisma.leadList.findUnique({ where: { id } })

  if (!list) {
    return NextResponse.json({ error: "List not found" }, { status: 404 })
  }
  if (list.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const parsed = updateListSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const updated = await prisma.leadList.update({
    where: { id },
    data: parsed.data,
  })

  return NextResponse.json(updated)
}

// DELETE /api/lists/[id] — delete list (cascades entries)
export async function DELETE(_req: NextRequest, context: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const list = await prisma.leadList.findUnique({ where: { id } })

  if (!list) {
    return NextResponse.json({ error: "List not found" }, { status: 404 })
  }
  if (list.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await prisma.leadList.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
