import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import {
  agentStatusSchema,
  createAgentSchema,
} from "@/lib/validators/agent"

// GET /api/ai/agent — list all agents for current user
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const status = searchParams.get("status")

  if (status && !agentStatusSchema.safeParse(status).success) {
    return NextResponse.json({ error: "Invalid agent status" }, { status: 400 })
  }

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

  const body = await req.json().catch(() => null)
  const parsed = createAgentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid agent", details: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const { name, description, autoSave } = parsed.data

  const agent = await prisma.aiAgent.create({
    data: {
      name,
      description: description || null,
      autoSave: autoSave === true,
      userId: session.user.id,
    },
  })

  return NextResponse.json(agent, { status: 201 })
}
