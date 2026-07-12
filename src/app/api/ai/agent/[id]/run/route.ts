import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { ensureUser } from "@/lib/ensure-user"
import { AgentRunError, runAgent } from "@/services/agent-runner"

type RouteContext = { params: Promise<{ id: string }> }

// POST /api/ai/agent/[id]/run - execute an agent run manually.
export async function POST(_req: NextRequest, context: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  await ensureUser(session)

  const { id } = await context.params
  const agent = await prisma.aiAgent.findUnique({ where: { id } })

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 })
  }
  if (agent.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const lockTime = new Date()
  const staleLockBefore = new Date(lockTime.getTime() - 60 * 60 * 1000)
  const lock = await prisma.aiAgent.updateMany({
    where: {
      id,
      userId: session.user.id,
      OR: [
        { schedulerLockAt: null },
        { schedulerLockAt: { lt: staleLockBefore } },
      ],
    },
    data: { schedulerLockAt: lockTime },
  })
  if (lock.count === 0) {
    return NextResponse.json(
      { error: "This agent is already running", code: "AGENT_ALREADY_RUNNING" },
      { status: 409 }
    )
  }

  try {
    const lockedAgent = await prisma.aiAgent.findUnique({ where: { id } })
    if (!lockedAgent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 })
    }
    const result = await runAgent(lockedAgent, {
      id: session.user.id,
      email: session.user.email,
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof AgentRunError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          purchaseUrl: error.purchaseUrl,
          searchId: error.searchId,
        },
        { status: error.status }
      )
    }

    const message = error instanceof Error ? error.message : "Agent execution failed"
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    await prisma.aiAgent.updateMany({
      where: { id, schedulerLockAt: lockTime },
      data: { schedulerLockAt: null },
    })
  }
}
