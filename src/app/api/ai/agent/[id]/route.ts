import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { updateAgentSchema } from "@/lib/validators/agent"

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/ai/agent/[id] — get single agent
export async function GET(_req: NextRequest, context: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const agent = await prisma.aiAgent.findUnique({ where: { id } })

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 })
  }
  if (agent.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  return NextResponse.json(agent)
}

// PATCH /api/ai/agent/[id] — update agent
export async function PATCH(req: NextRequest, context: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const agent = await prisma.aiAgent.findUnique({ where: { id } })

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 })
  }
  if (agent.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = updateAgentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid agent update", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  if (parsed.data.config?.listId) {
    const targetList = await prisma.leadList.findFirst({
      where: {
        id: parsed.data.config.listId,
        userId: session.user.id,
        status: "ACTIVE",
        ...(parsed.data.config.searchType
          ? { type: parsed.data.config.searchType }
          : {}),
      },
      select: { id: true },
    })
    if (!targetList) {
      return NextResponse.json(
        { error: "Invalid agent target list" },
        { status: 400 }
      )
    }
  }

  const updated = await prisma.aiAgent.update({
    where: { id },
    data: {
      ...parsed.data,
      config: parsed.data.config
        ? JSON.parse(JSON.stringify(parsed.data.config))
        : undefined,
    },
  })

  return NextResponse.json(updated)
}

// DELETE /api/ai/agent/[id] — delete agent
export async function DELETE(_req: NextRequest, context: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const agent = await prisma.aiAgent.findUnique({ where: { id } })

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 })
  }
  if (agent.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await prisma.aiAgent.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
