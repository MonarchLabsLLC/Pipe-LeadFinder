import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { guardCredits } from "@/lib/credit-guard"
import { enqueueBulkJob } from "@/services/bulk-job"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json().catch(() => null)
  const listId = body && typeof body === "object" ? (body as { listId?: unknown }).listId : null
  if (typeof listId !== "string") {
    return NextResponse.json({ error: "listId is required" }, { status: 400 })
  }
  const list = await prisma.leadList.findFirst({
    where: { id: listId, userId: session.user.id },
  })
  if (!list) return NextResponse.json({ error: "List not found" }, { status: 404 })
  const blocked = await guardCredits(session.user.id, session.user.email)
  if (blocked) return blocked

  const entries = await prisma.leadListEntry.findMany({
    where: {
      listId,
      lead: {
        OR: [
          { email: null },
          { emailStatus: { in: ["UNKNOWN", "NOT_FOUND"] } },
        ],
      },
    },
    select: { id: true },
    take: 1_000,
  })
  if (!entries.length) {
    return NextResponse.json({ attempted: 0, enriched: 0, message: "No leads need enrichment" })
  }
  const job = await enqueueBulkJob({
    userId: session.user.id,
    userEmail: session.user.email,
    listId,
    entryIds: entries.map((entry) => entry.id),
    action: "ENRICH_EMAIL",
    idempotencyKey: req.headers.get("idempotency-key"),
  })
  return NextResponse.json({
    jobId: job.id,
    status: "QUEUED",
    attempted: entries.length,
    statusUrl: `/api/jobs/${job.id}`,
  }, { status: 202 })
}
