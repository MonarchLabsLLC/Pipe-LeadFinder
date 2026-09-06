export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  if (process.env.PIPELEADS_JOBS_ENABLED !== "false") {
    const { startJobRuntime } = await import("@/lib/jobs/runtime")
    await startJobRuntime()
  }
  if (process.env.SCALEPLUS_AUTOMATIONS_ENABLED === "true") {
    const { getAutomationPool } = await import("./lib/scaleplus-automations/runtime")
    const { startAutomationWorker } = await import("./lib/scaleplus-automations/delivery")
    startAutomationWorker(getAutomationPool())
  }
}
