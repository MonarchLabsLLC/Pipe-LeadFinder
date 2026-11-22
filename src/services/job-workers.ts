import type { PgBoss } from "pg-boss"
import { JOB_QUEUES } from "@/lib/jobs/constants"
import { runTrackedJob } from "@/lib/jobs/service"
import { processSearchJob } from "@/services/search-job"
import { processAgentJob } from "@/services/agent-job"
import { processBulkJob } from "@/services/bulk-job"
import { processIntegrationDelivery } from "@/services/integration-job"
import { reportAgentRunCompleted, reportJobCompleted } from "@/server/plugins/job-events"

export async function registerJobWorkers(boss: PgBoss) {
  await boss.work<{ jobRunId: string }>(
    JOB_QUEUES.SEARCH,
    {
      localConcurrency: 2,
      groupConcurrency: 1,
      pollingIntervalSeconds: 2,
      heartbeatRefreshSeconds: 30,
    },
    async ([job]) => {
      if (!job) return
      await runTrackedJob(job.data.jobRunId, () =>
        processSearchJob(job.data.jobRunId)
      )
      // Scale Plugin Store: tell installed plugins (no-op when the channel is
      // off; never throws, so it cannot fail or retry a finished job).
      await reportJobCompleted(job.data.jobRunId)
    }
  )

  await boss.work<{ jobRunId: string }>(
    JOB_QUEUES.AGENT_RUN,
    {
      localConcurrency: 1,
      groupConcurrency: 1,
      pollingIntervalSeconds: 2,
      heartbeatRefreshSeconds: 30,
    },
    async ([job]) => {
      if (!job) return
      await runTrackedJob(job.data.jobRunId, () =>
        processAgentJob(job.data.jobRunId)
      )
      // Scale Plugin Store: no-op when the channel is off; never throws.
      await reportAgentRunCompleted(job.data.jobRunId)
    }
  )

  for (const queue of [
    JOB_QUEUES.BULK_ENRICH_EMAIL,
    JOB_QUEUES.BULK_ENRICH_PHONE,
    JOB_QUEUES.BULK_SCORE,
  ]) {
    await boss.work<{ jobRunId: string }>(
      queue,
      {
        localConcurrency: 2,
        groupConcurrency: 1,
        pollingIntervalSeconds: 2,
        heartbeatRefreshSeconds: 30,
      },
      async ([job]) => {
        if (!job) return
        await runTrackedJob(job.data.jobRunId, () =>
          processBulkJob(job.data.jobRunId)
        )
        await reportJobCompleted(job.data.jobRunId)
      }
    )
  }

  await boss.work<{ jobRunId: string }>(
    JOB_QUEUES.INTEGRATION_DELIVERY,
    {
      localConcurrency: 4,
      groupConcurrency: 1,
      pollingIntervalSeconds: 2,
      heartbeatRefreshSeconds: 30,
    },
    async ([job]) => {
      if (!job) return
      await runTrackedJob(job.data.jobRunId, () =>
        processIntegrationDelivery(job.data.jobRunId)
      )
    }
  )
}
