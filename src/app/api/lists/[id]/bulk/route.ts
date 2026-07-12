import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { bulkActionSchema } from "@/lib/validators/bulk"
import { guardCredits } from "@/lib/credit-guard"
import { enqueueBulkJob } from "@/services/bulk-job"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id: listId } = await context.params
  const parsed = bulkActionSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid bulk action", details: parsed.error.flatten() }, { status: 400 })
  }

  const list = await prisma.leadList.findFirst({
    where: { id: listId, userId: session.user.id },
  })
  if (!list) return NextResponse.json({ error: "List not found" }, { status: 404 })
  const entryIds = [...new Set(parsed.data.entryIds)]
  const entries = await prisma.leadListEntry.findMany({
    where: { id: { in: entryIds }, listId },
    include: { labels: true },
  })
  if (entries.length !== entryIds.length) {
    return NextResponse.json({ error: "One or more selected leads are invalid" }, { status: 400 })
  }

  if (["ENRICH_EMAIL", "ENRICH_PHONE", "SCORE"].includes(parsed.data.action)) {
    const blocked = await guardCredits(session.user.id, session.user.email)
    if (blocked) return blocked
    const job = await enqueueBulkJob({
      userId: session.user.id,
      userEmail: session.user.email,
      listId,
      entryIds,
      action: parsed.data.action as "ENRICH_EMAIL" | "ENRICH_PHONE" | "SCORE",
      idempotencyKey: req.headers.get("idempotency-key"),
    })
    return NextResponse.json({
      jobId: job.id,
      status: "QUEUED",
      statusUrl: `/api/jobs/${job.id}`,
    }, { status: 202 })
  }

  const { labelId, targetListId } = parsed.data.options
  if (parsed.data.action === "APPLY_LABEL" || parsed.data.action === "REMOVE_LABEL") {
    if (!labelId) return NextResponse.json({ error: "labelId is required" }, { status: 400 })
    const label = await prisma.customLabel.findFirst({
      where: { id: labelId, userId: session.user.id },
    })
    if (!label) return NextResponse.json({ error: "Label not found" }, { status: 404 })
    if (parsed.data.action === "APPLY_LABEL") {
      await prisma.leadEntryLabel.createMany({
        data: entryIds.map((entryId) => ({ entryId, labelId })),
        skipDuplicates: true,
      })
    } else {
      await prisma.leadEntryLabel.deleteMany({
        where: { entryId: { in: entryIds }, labelId },
      })
    }
    return NextResponse.json({ updated: entryIds.length })
  }

  if (parsed.data.action === "REMOVE") {
    const leadIds = entries.map((entry) => entry.leadId)
    await prisma.$transaction(async (tx) => {
      await tx.leadListEntry.deleteMany({ where: { id: { in: entryIds } } })
      await tx.lead.deleteMany({
        where: { id: { in: leadIds }, listEntries: { none: {} } },
      })
    })
    return NextResponse.json({ removed: entryIds.length })
  }

  if (!targetListId) {
    return NextResponse.json({ error: "targetListId is required" }, { status: 400 })
  }
  const target = await prisma.leadList.findFirst({
    where: {
      id: targetListId,
      userId: session.user.id,
      status: "ACTIVE",
      type: list.type,
    },
  })
  if (!target) return NextResponse.json({ error: "Target list not found" }, { status: 404 })

  await prisma.$transaction(async (tx) => {
    for (const entry of entries) {
      const targetEntry = await tx.leadListEntry.upsert({
        where: { listId_leadId: { listId: targetListId, leadId: entry.leadId } },
        update: {},
        create: { listId: targetListId, leadId: entry.leadId },
      })
      if (entry.labels.length) {
        await tx.leadEntryLabel.createMany({
          data: entry.labels.map((label) => ({
            entryId: targetEntry.id,
            labelId: label.labelId,
          })),
          skipDuplicates: true,
        })
      }
      if (parsed.data.action === "MOVE") {
        await tx.leadListEntry.delete({ where: { id: entry.id } })
      }
    }
  })
  return NextResponse.json({ updated: entries.length, targetListId })
}
