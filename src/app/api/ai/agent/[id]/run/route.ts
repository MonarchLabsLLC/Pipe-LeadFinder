import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { ensureUser } from "@/lib/ensure-user"
import { enqueueAgentJob } from "@/services/agent-job"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await ensureUser(session)
  const { id } = await context.params
  const agent = await prisma.aiAgent.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  })
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 })

  try {
    const job = await enqueueAgentJob({
      agentId: id,
      userId: session.user.id,
      userEmail: session.user.email,
      idempotencyKey: req.headers.get("idempotency-key"),
    })
    return NextResponse.json({
      jobId: job.id,
      agentId: id,
      status: "QUEUED",
      statusUrl: `/api/jobs/${job.id}`,
    }, { status: 202 })
  } catch (error) {
    const conflict = error instanceof Error && error.name === "AgentAlreadyRunningError"
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to queue agent",
        code: conflict ? "AGENT_ALREADY_RUNNING" : "AGENT_QUEUE_FAILED",
      },
      { status: conflict ? 409 : 500 }
    )
  }
}
