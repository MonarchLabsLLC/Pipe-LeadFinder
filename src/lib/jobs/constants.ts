import type { JobKind } from "@/generated/prisma/enums"

export const JOB_QUEUES = {
  SEARCH: "pipeleads-search",
  AGENT_RUN: "pipeleads-agent-run",
  BULK_ENRICH_EMAIL: "pipeleads-bulk-enrich-email",
  BULK_ENRICH_PHONE: "pipeleads-bulk-enrich-phone",
  BULK_SCORE: "pipeleads-bulk-score",
  INTEGRATION_DELIVERY: "pipeleads-integration-delivery",
} as const satisfies Record<JobKind, string>

export type JobQueueName = (typeof JOB_QUEUES)[JobKind]

export const JOB_RETENTION_SECONDS = 90 * 24 * 60 * 60

export const JOB_SEND_OPTIONS = {
  retryLimit: 3,
  retryDelay: 5,
  retryBackoff: true,
  retryDelayMax: 5 * 60,
  heartbeatSeconds: 60,
  expireInSeconds: 60 * 60,
  deleteAfterSeconds: JOB_RETENTION_SECONDS,
} as const
