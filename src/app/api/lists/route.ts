import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { ensureUser } from "@/lib/ensure-user"
import { createListSchema } from "@/lib/validators/list"

// GET /api/lists — returns all lists for current user with lead counts
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  await ensureUser(session)

  const { searchParams } = req.nextUrl
  const type = searchParams.get("type")
  const status = searchParams.get("status") || "ACTIVE"

  const where: Record<string, unknown> = { userId: session.user.id }
  if (type) where.type = type
  if (status) where.status = status

  const lists = await prisma.leadList.findMany({
    where,
    include: {
      _count: {
        select: { leads: true },
      },
      leads: {
        include: {
          lead: {
            select: { emailStatus: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = lists.map((list: any) => {
    const emailFoundCount = list.leads.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (entry: any) => entry.lead.emailStatus === "FOUND"
    ).length

    return {
      id: list.id,
      name: list.name,
      type: list.type,
      status: list.status,
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
      leadCount: list._count.leads,
      emailFoundCount,
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
  await ensureUser(session)

  const body = await req.json()
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
      userId: session.user.id,
    },
  })

  return NextResponse.json(list, { status: 201 })
}
