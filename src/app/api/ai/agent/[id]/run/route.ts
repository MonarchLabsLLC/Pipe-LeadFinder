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

  try {
    const result = await runAgent(agent, {
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
  }
}
