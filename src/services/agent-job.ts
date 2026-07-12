import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { createAndEnqueueJob } from "@/lib/jobs/service"
import {
  clearSchedulerLock,
  getNextScheduledRunAt,
  runAgent,
  serializeAgentConfig,
  type AgentConfig,
} from "@/services/agent-runner"

const payloadSchema = z.object({
  agentId: z.string().min(1),
  userId: z.string().min(1),
  userEmail: z.string().email().nullable().optional(),
  lockTime: z.string().datetime(),
  scheduled: z.boolean().default(false),
  scheduledAt: z.string().datetime().nullable().optional(),
})

export async function enqueueAgentJob(input: {
  agentId: string
  userId: string
  userEmail?: string | null
  idempotencyKey?: string | null
  scheduled?: boolean
  scheduledAt?: Date
  alreadyLockedAt?: Date
}) {
  if (input.idempotencyKey) {
    const existing = await prisma.jobRun.findUnique({
      where: {
        userId_idempotencyKey: {
          userId: input.userId,
          idempotencyKey: input.idempotencyKey.trim(),
        },
      },
    })
    if (existing) return existing
  }
  const lockTime = input.alreadyLockedAt ?? new Date()
  if (!input.alreadyLockedAt) {
    const staleBefore = new Date(lockTime.getTime() - 60 * 60 * 1000)
    const lock = await prisma.aiAgent.updateMany({
      where: {
        id: input.agentId,
        userId: input.userId,
        OR: [
          { schedulerLockAt: null },
          { schedulerLockAt: { lt: staleBefore } },
        ],
      },
      data: { schedulerLockAt: lockTime },
    })
    if (lock.count === 0) {
      const error = new Error("This agent is already queued or running")
      error.name = "AgentAlreadyRunningError"
      throw error
    }
  }

  try {
    return await createAndEnqueueJob({
      userId: input.userId,
      kind: "AGENT_RUN",
      idempotencyKey: input.idempotencyKey || undefined,
      agentId: input.agentId,
      payload: {
        agentId: input.agentId,
        userId: input.userId,
        userEmail: input.userEmail ?? null,
        lockTime: lockTime.toISOString(),
        scheduled: input.scheduled ?? false,
        scheduledAt: input.scheduledAt?.toISOString() ?? null,
      },
    })
  } catch (error) {
    await prisma.aiAgent.updateMany({
      where: { id: input.agentId, schedulerLockAt: lockTime },
      data: { schedulerLockAt: null },
    })
    throw error
  }
}

export async function processAgentJob(jobRunId: string) {
  const jobRun = await prisma.jobRun.findUnique({ where: { id: jobRunId } })
  if (!jobRun) throw new Error("Agent job not found")
  const payload = payloadSchema.parse(jobRun.payload)
  const lockTime = new Date(payload.lockTime)
  const agent = await prisma.aiAgent.findFirst({
    where: { id: payload.agentId, userId: payload.userId },
  })
  if (!agent) throw new Error("Agent not found")

  try {
    const result = await runAgent(agent, {
      id: payload.userId,
      email: payload.userEmail,
    })
    await prisma.jobRun.update({
      where: { id: jobRunId },
      data: { listId: result.listId, searchId: result.searchId },
    })

    if (payload.scheduled) {
      const latest = await prisma.aiAgent.findUnique({ where: { id: payload.agentId } })
      const config = clearSchedulerLock((latest?.config ?? {}) as AgentConfig)
      const scheduledAt = payload.scheduledAt
        ? new Date(payload.scheduledAt)
        : new Date()
      await prisma.aiAgent.update({
        where: { id: payload.agentId },
        data: {
          config: serializeAgentConfig({
            ...config,
            lastScheduledRunAt: scheduledAt.toISOString(),
            lastScheduledStatus: "completed",
            lastScheduledError: null,
            nextScheduledRunAt: getNextScheduledRunAt(
              config.schedule,
              scheduledAt
            ),
          }),
        },
      })
    }
    return result
  } catch (error) {
    if (payload.scheduled) {
      const latest = await prisma.aiAgent.findUnique({ where: { id: payload.agentId } })
      const config = clearSchedulerLock((latest?.config ?? {}) as AgentConfig)
      const scheduledAt = payload.scheduledAt
        ? new Date(payload.scheduledAt)
        : new Date()
      await prisma.aiAgent.update({
        where: { id: payload.agentId },
        data: {
          config: serializeAgentConfig({
            ...config,
            lastScheduledRunAt: scheduledAt.toISOString(),
            lastScheduledStatus: "failed",
            lastScheduledError: error instanceof Error ? error.message : "Agent run failed",
            nextScheduledRunAt: getNextScheduledRunAt(config.schedule, scheduledAt),
          }),
        },
      })
    }
    throw error
  } finally {
    await prisma.aiAgent.updateMany({
      where: { id: payload.agentId, schedulerLockAt: lockTime },
      data: { schedulerLockAt: null },
    })
  }
}
