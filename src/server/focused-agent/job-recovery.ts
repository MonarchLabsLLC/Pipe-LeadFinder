import { prisma } from "@/lib/prisma"
import type { JobRun } from "@/generated/prisma/client"

/** A lost worker is an uncertain paid operation, never permission to replay it. */
export async function recoverApprovedJob(job: JobRun) {
  if (job.status !== "RUNNING" || job.updatedAt.getTime() >= Date.now() - 90000)
    return job
  await prisma.jobRun.updateMany({
    where: {
      id: job.id,
      userId: job.userId,
      status: "RUNNING",
      updatedAt: { lt: new Date(Date.now() - 90000) },
    },
    data: {
      status: "FAILED",
      stage: "Needs review",
      errorCode: "FOCUSED_JOB_INTERRUPTED",
      errorMessage:
        "The approved worker was interrupted. Inspect any recorded results or charges before preparing another operation; this job will not be automatically repeated.",
      completedAt: new Date(),
    },
  })
  return prisma.jobRun.findUniqueOrThrow({ where: { id: job.id } })
}
