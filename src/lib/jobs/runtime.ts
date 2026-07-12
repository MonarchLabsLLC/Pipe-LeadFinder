import { getJobBoss, stopJobBoss } from "@/lib/jobs/queue"

type RuntimeGlobal = typeof globalThis & {
  pipeLeadsWorkersStarted?: boolean
  pipeLeadsSignalsRegistered?: boolean
}

const runtimeGlobal = globalThis as RuntimeGlobal

export async function startJobRuntime() {
  if (runtimeGlobal.pipeLeadsWorkersStarted) return
  const boss = await getJobBoss()
  const { registerJobWorkers } = await import("@/services/job-workers")
  await registerJobWorkers(boss)
  runtimeGlobal.pipeLeadsWorkersStarted = true

  if (!runtimeGlobal.pipeLeadsSignalsRegistered) {
    runtimeGlobal.pipeLeadsSignalsRegistered = true
    const shutdown = () => {
      void stopJobBoss().catch((error) => {
        console.error("[Jobs] Graceful shutdown failed", error)
      })
    }
    process.once("SIGTERM", shutdown)
    process.once("SIGINT", shutdown)
  }
}
