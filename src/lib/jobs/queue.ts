import { PgBoss } from "pg-boss"
import { getDatabaseConfig, getSslConfig } from "@/lib/prisma"
import { JOB_QUEUES } from "@/lib/jobs/constants"

type JobGlobal = typeof globalThis & {
  pipeLeadsBoss?: PgBoss
  pipeLeadsBossStart?: Promise<PgBoss>
}

const jobGlobal = globalThis as JobGlobal

function createBoss() {
  const { connectionString } = getDatabaseConfig()
  const boss = new PgBoss({
    connectionString,
    ssl: getSslConfig(),
    schema: "pgboss_pipeleads",
    application_name: "pipeleads-jobs",
    max: 5,
    persistWarnings: true,
    warningRetentionDays: 30,
  })

  boss.on("error", (error) => {
    console.error("[Jobs] pg-boss error", error)
  })
  boss.on("warning", (warning) => {
    console.warn("[Jobs] pg-boss warning", warning)
  })
  return boss
}

export async function getJobBoss() {
  if (jobGlobal.pipeLeadsBoss) return jobGlobal.pipeLeadsBoss
  if (jobGlobal.pipeLeadsBossStart) return jobGlobal.pipeLeadsBossStart

  jobGlobal.pipeLeadsBossStart = (async () => {
    const boss = createBoss()
    await boss.start()
    await Promise.all(
      Object.values(JOB_QUEUES).map((name) =>
        boss.createQueue(name).catch(async (error) => {
          const existing = await boss.getQueue(name)
          if (!existing) throw error
        })
      )
    )
    jobGlobal.pipeLeadsBoss = boss
    return boss
  })()

  try {
    return await jobGlobal.pipeLeadsBossStart
  } catch (error) {
    jobGlobal.pipeLeadsBossStart = undefined
    throw error
  }
}

export async function stopJobBoss() {
  const boss = jobGlobal.pipeLeadsBoss
  if (!boss) return
  jobGlobal.pipeLeadsBoss = undefined
  jobGlobal.pipeLeadsBossStart = undefined
  await boss.stop({ graceful: true, timeout: 30_000 })
}
