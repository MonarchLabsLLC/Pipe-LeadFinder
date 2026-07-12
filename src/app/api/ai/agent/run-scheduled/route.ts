import { NextRequest, NextResponse } from "next/server"
import { timingSafeEqual } from "node:crypto"
import { prisma } from "@/lib/prisma"
import {
  isScheduledAgentDue,
  serializeAgentConfig,
  type AgentConfig,
} from "@/services/agent-runner"
import { enqueueAgentJob } from "@/services/agent-job"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function suppliedSecret(req: NextRequest) {
  const direct = req.headers.get("x-cron-secret")
  if (direct) return direct
  const authorization = req.headers.get("authorization")
  return authorization?.toLowerCase().startsWith("bearer ")
    ? authorization.slice("bearer ".length).trim()
    : null
}

function isAuthorized(req: NextRequest) {
  const expected = process.env.PIPELEADS_AGENT_CRON_SECRET
  const supplied = suppliedSecret(req)
  if (!expected || !supplied) return false
  const expectedBuffer = Buffer.from(expected)
  const suppliedBuffer = Buffer.from(supplied)
  return expectedBuffer.length === suppliedBuffer.length &&
    timingSafeEqual(expectedBuffer, suppliedBuffer)
}

export async function POST(req: NextRequest) {
  if (!process.env.PIPELEADS_AGENT_CRON_SECRET) {
    return NextResponse.json(
      { error: "PIPELEADS_AGENT_CRON_SECRET is not configured" },
      { status: 503 }
    )
  }
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const staleLockBefore = new Date(now.getTime() - 60 * 60 * 1000)
  const agents = await prisma.aiAgent.findMany({
    where: { status: "ACTIVE" },
    include: { user: { select: { id: true, email: true } } },
    orderBy: { updatedAt: "asc" },
  })
  const results: Array<{
    agentId: string
    status: "queued" | "skipped" | "failed"
    jobId?: string
    error?: string
  }> = []

  for (const agent of agents) {
    const config = (agent.config ?? {}) as AgentConfig
    if (!isScheduledAgentDue(config, now)) {
      results.push({ agentId: agent.id, status: "skipped" })
      continue
    }

    const lock = await prisma.aiAgent.updateMany({
      where: {
        id: agent.id,
        status: "ACTIVE",
        OR: [
          { schedulerLockAt: null },
          { schedulerLockAt: { lt: staleLockBefore } },
        ],
      },
      data: {
        schedulerLockAt: now,
        config: serializeAgentConfig({
          ...config,
          lastScheduledStatus: "running",
          lastScheduledError: null,
        }),
      },
    })
    if (lock.count === 0) {
      results.push({ agentId: agent.id, status: "skipped" })
      continue
    }

    try {
      const job = await enqueueAgentJob({
        agentId: agent.id,
        userId: agent.user.id,
        userEmail: agent.user.email,
        idempotencyKey: `scheduled:${agent.id}:${now.toISOString()}`,
        scheduled: true,
        scheduledAt: now,
        alreadyLockedAt: now,
      })
      results.push({ agentId: agent.id, status: "queued", jobId: job.id })
    } catch (error) {
      results.push({
        agentId: agent.id,
        status: "failed",
        error: error instanceof Error ? error.message : "Failed to queue agent",
      })
    }
  }

  return NextResponse.json(
    {
      checked: agents.length,
      queued: results.filter((result) => result.status === "queued").length,
      results,
    },
    { status: 202, headers: { "Cache-Control": "no-store" } }
  )
}
