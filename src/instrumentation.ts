export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  if (process.env.PIPELEADS_JOBS_ENABLED === "false") return

  const { startJobRuntime } = await import("@/lib/jobs/runtime")
  await startJobRuntime()
}
