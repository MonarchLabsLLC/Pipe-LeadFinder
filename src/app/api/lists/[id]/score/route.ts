import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { guardCredits } from "@/lib/credit-guard"
import { enqueueBulkJob } from "@/services/bulk-job"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id: listId } = await context.params
  const list = await prisma.leadList.findFirst({
    where: { id: listId, userId: session.user.id },
  })
  if (!list) return NextResponse.json({ error: "List not found" }, { status: 404 })
  const blocked = await guardCredits(session.user.id, session.user.email)
  if (blocked) return blocked

  const body = await req.json().catch(() => ({}))
  const requestedLimit = Number(
    body && typeof body === "object" ? (body as Record<string, unknown>).limit : undefined
  )
  const take = Number.isInteger(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, 1_000)
    : 1_000
  const entries = await prisma.leadListEntry.findMany({
    where: { listId },
    select: { id: true },
    take,
    orderBy: { createdAt: "desc" },
  })
  if (!entries.length) {
    return NextResponse.json({ scoredCount: 0, message: "This list has no leads to score" })
  }
  const job = await enqueueBulkJob({
    userId: session.user.id,
    userEmail: session.user.email,
    listId,
    entryIds: entries.map((entry) => entry.id),
    action: "SCORE",
    idempotencyKey: req.headers.get("idempotency-key"),
  })
  return NextResponse.json({
    jobId: job.id,
    status: "QUEUED",
    attempted: entries.length,
    statusUrl: `/api/jobs/${job.id}`,
  }, { status: 202 })
}
