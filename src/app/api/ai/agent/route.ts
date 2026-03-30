import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

// GET /api/ai/agent — list all agents for current user
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const status = searchParams.get("status")

  const where: Record<string, unknown> = { userId: session.user.id }
  if (status) where.status = status

  const agents = await prisma.aiAgent.findMany({
    where,
    orderBy: { updatedAt: "desc" },
  })

  return NextResponse.json(agents)
}

// POST /api/ai/agent — create new agent
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { name, description, autoSave } = body

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json(
      { error: "Name is required" },
      { status: 400 }
    )
  }

  const agent = await prisma.aiAgent.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      autoSave: autoSave === true,
      userId: session.user.id,
    },
  })

  return NextResponse.json(agent, { status: 201 })
}
