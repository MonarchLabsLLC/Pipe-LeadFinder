import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { resolveWorkspaceScope } from "@/lib/scale-workspace/guest"
import { prisma } from "@/lib/prisma"
import { publicJobRun } from "@/lib/jobs/service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const scope = await resolveWorkspaceScope(session, {
    method: "GET",
    path: "/api/jobs/[jobId]",
  })
  if (!scope.ok) {
    return scope.response
  }

  const { jobId } = await params
  const job = await prisma.jobRun.findFirst({
    where: { id: jobId, userId: scope.tenantUserId },
  })
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 })
  }

  return NextResponse.json(publicJobRun(job), {
    headers: { "Cache-Control": "no-store" },
  })
}
