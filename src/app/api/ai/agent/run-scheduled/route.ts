import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  AgentRunError,
  clearSchedulerLock,
  getNextScheduledRunAt,
  isScheduledAgentDue,
  runAgent,
  serializeAgentConfig,
  type AgentConfig,
} from "@/services/agent-runner"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function getBearerToken(req: NextRequest) {
  const authorization = req.headers.get("authorization")
  if (!authorization?.toLowerCase().startsWith("bearer ")) return null
  return authorization.slice("bearer ".length).trim()
}

function isAuthorized(req: NextRequest) {
  const secret = process.env.PIPELEADS_AGENT_CRON_SECRET
  if (!secret) return false

  const supplied =
    req.headers.get("x-cron-secret") ||
    getBearerToken(req) ||
    req.nextUrl.searchParams.get("secret")

  return supplied === secret
}

async function updateAgentScheduleConfig(agentId: string, config: AgentConfig) {
  await prisma.aiAgent.update({
    where: { id: agentId },
    data: { config: serializeAgentConfig(config) },
  })
}

async function runScheduled(req: NextRequest) {
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
  const nowIso = now.toISOString()
  const agents = await prisma.aiAgent.findMany({
    where: { status: "ACTIVE" },
    include: { user: { select: { id: true, email: true } } },
    orderBy: { updatedAt: "asc" },
  })

  const results: Array<{
    agentId: string
    status: "completed" | "failed" | "skipped"
    searchId?: string
    leadCount?: number
    nextScheduledRunAt?: string | null
    error?: string
  }> = []

  for (const agent of agents) {
    const config = (agent.config ?? {}) as AgentConfig
    if (!isScheduledAgentDue(config, now)) {
      results.push({ agentId: agent.id, status: "skipped" })
      continue
    }

    const lockedConfig: AgentConfig = {
      ...config,
      schedulerLockAt: nowIso,
      lastScheduledStatus: "running",
      lastScheduledError: null,
    }

    const lockedAgent = await prisma.aiAgent.update({
      where: { id: agent.id },
      data: { config: serializeAgentConfig(lockedConfig) },
    })

    try {
      const run = await runAgent(lockedAgent, {
        id: agent.user.id,
        email: agent.user.email,
      })
      const latestAgent = await prisma.aiAgent.findUnique({ where: { id: agent.id } })
      const latestConfig = clearSchedulerLock(
        ((latestAgent?.config ?? lockedConfig) as AgentConfig)
      )
      const nextScheduledRunAt = getNextScheduledRunAt(
        latestConfig.schedule ?? config.schedule,
        now
      )

      await updateAgentScheduleConfig(agent.id, {
        ...latestConfig,
        lastScheduledRunAt: nowIso,
        lastScheduledStatus: "completed",
        lastScheduledError: null,
        nextScheduledRunAt,
      })

      results.push({
        agentId: agent.id,
        status: "completed",
        searchId: run.searchId,
        leadCount: run.leadCount,
        nextScheduledRunAt,
      })
    } catch (error) {
      const latestAgent = await prisma.aiAgent.findUnique({ where: { id: agent.id } })
      const latestConfig = clearSchedulerLock(
        ((latestAgent?.config ?? lockedConfig) as AgentConfig)
      )
      const message =
        error instanceof AgentRunError || error instanceof Error
          ? error.message
          : "Scheduled agent run failed"
      const nextScheduledRunAt = getNextScheduledRunAt(
        latestConfig.schedule ?? config.schedule,
        now
      )

      await updateAgentScheduleConfig(agent.id, {
        ...latestConfig,
        lastScheduledRunAt: nowIso,
        lastScheduledStatus: "failed",
        lastScheduledError: message,
        nextScheduledRunAt,
      })

      results.push({
        agentId: agent.id,
        status: "failed",
        error: message,
        nextScheduledRunAt,
      })
    }
  }

  return NextResponse.json({
    checked: agents.length,
    ran: results.filter((result) => result.status !== "skipped").length,
    results,
  })
}

export async function POST(req: NextRequest) {
  return runScheduled(req)
}

export async function GET(req: NextRequest) {
  return runScheduled(req)
}
