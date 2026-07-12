import { randomUUID } from "node:crypto"
import type { JobKind, JobStatus } from "@/generated/prisma/enums"
import type { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import {
  JOB_QUEUES,
  JOB_SEND_OPTIONS,
  type JobQueueName,
} from "@/lib/jobs/constants"
import { getJobBoss } from "@/lib/jobs/queue"

interface CreateJobInput {
  userId: string
  kind: JobKind
  idempotencyKey?: string
  payload?: Prisma.InputJsonValue
  listId?: string
  searchId?: string
  agentId?: string
}

export async function createAndEnqueueJob(input: CreateJobInput) {
  const idempotencyKey = input.idempotencyKey?.trim() || randomUUID()
  const existing = await prisma.jobRun.findUnique({
    where: {
      userId_idempotencyKey: { userId: input.userId, idempotencyKey },
    },
  })
  if (existing) return existing

  let jobRun
  try {
    jobRun = await prisma.jobRun.create({
      data: {
        userId: input.userId,
        kind: input.kind,
        idempotencyKey,
        payload: input.payload,
        listId: input.listId,
        searchId: input.searchId,
        agentId: input.agentId,
        stage: "Queued",
      },
    })
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") {
      const raced = await prisma.jobRun.findUnique({
        where: { userId_idempotencyKey: { userId: input.userId, idempotencyKey } },
      })
      if (raced) return raced
    }
    throw error
  }

  try {
    const boss = await getJobBoss()
    const queue = JOB_QUEUES[input.kind] as JobQueueName
    const queueJobId = await boss.send(
      queue,
      { jobRunId: jobRun.id },
      {
        ...JOB_SEND_OPTIONS,
        singletonKey: jobRun.id,
        group: { id: input.userId },
      }
    )
    if (!queueJobId) throw new Error("The queue rejected the job")

    return prisma.jobRun.update({
      where: { id: jobRun.id },
      data: { queueJobId },
    })
  } catch (error) {
    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: {
        status: "FAILED",
        stage: "Queue submission failed",
        errorCode: "QUEUE_SUBMISSION_FAILED",
        errorMessage: error instanceof Error ? error.message : "Queue submission failed",
        completedAt: new Date(),
      },
    })
    throw error
  }
}

export async function updateJobProgress(
  jobRunId: string,
  input: {
    stage?: string
    current?: number
    total?: number
    status?: JobStatus
    result?: Prisma.InputJsonValue
  }
) {
  return prisma.jobRun.update({
    where: { id: jobRunId },
    data: {
      stage: input.stage,
      progressCurrent: input.current,
      progressTotal: input.total,
      status: input.status,
      result: input.result,
    },
  })
}

export async function runTrackedJob<T>(
  jobRunId: string,
  handler: () => Promise<T>
) {
  await prisma.jobRun.update({
    where: { id: jobRunId },
    data: {
      status: "RUNNING",
      stage: "Starting",
      startedAt: new Date(),
      completedAt: null,
      errorCode: null,
      errorMessage: null,
    },
  })

  try {
    const result = await handler()
    await prisma.jobRun.update({
      where: { id: jobRunId },
      data: {
        status: "COMPLETED",
        stage: "Completed",
        completedAt: new Date(),
        result: JSON.parse(JSON.stringify(result ?? null)),
      },
    })
    return result
  } catch (error) {
    await prisma.jobRun.update({
      where: { id: jobRunId },
      data: {
        status: "FAILED",
        stage: "Failed",
        errorCode: "JOB_FAILED",
        errorMessage: error instanceof Error ? error.message : "Job failed",
        completedAt: new Date(),
      },
    })
    throw error
  }
}

export function publicJobRun(job: {
  id: string
  kind: JobKind
  status: JobStatus
  stage: string | null
  progressCurrent: number
  progressTotal: number
  result: Prisma.JsonValue | null
  errorCode: string | null
  errorMessage: string | null
  listId: string | null
  searchId: string | null
  agentId: string | null
  createdAt: Date
  startedAt: Date | null
  completedAt: Date | null
}) {
  const percent = job.progressTotal > 0
    ? Math.min(100, Math.round((job.progressCurrent / job.progressTotal) * 100))
    : job.status === "COMPLETED" ? 100 : 0

  return {
    jobId: job.id,
    kind: job.kind,
    status: job.status,
    stage: job.stage,
    progress: {
      current: job.progressCurrent,
      total: job.progressTotal,
      percent,
    },
    result: job.result,
    error: job.errorMessage
      ? { code: job.errorCode || "JOB_FAILED", message: job.errorMessage }
      : null,
    resources: {
      listId: job.listId,
      searchId: job.searchId,
      agentId: job.agentId,
    },
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  }
}
