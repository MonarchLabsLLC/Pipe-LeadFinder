import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getJobBoss } from "@/lib/jobs/queue"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const [, boss] = await Promise.all([
      prisma.$queryRaw`SELECT 1`,
      getJobBoss(),
    ])
    const queueVersion = await boss.schemaVersion()
    return NextResponse.json(
      { status: "ok", database: "ready", queue: "ready", queueVersion },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch {
    return NextResponse.json(
      { status: "degraded", database: "unavailable", queue: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    )
  }
}
