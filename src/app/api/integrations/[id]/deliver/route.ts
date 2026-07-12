import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { deliverIntegrationSchema } from "@/lib/validators/integration"
import { enqueueIntegrationDelivery, newDeliveryId } from "@/services/integration-job"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const parsed = deliverIntegrationSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid delivery", details: parsed.error.flatten() }, { status: 400 })
  const connection = await prisma.integrationConnection.findFirst({
    where: { id: (await params).id, userId: session.user.id, enabled: true },
  })
  if (!connection) return NextResponse.json({ error: "Integration not found" }, { status: 404 })
  const entries = await prisma.leadListEntry.count({
    where: { id: { in: [...new Set(parsed.data.entryIds)] }, listId: parsed.data.listId, list: { userId: session.user.id } },
  })
  if (entries !== new Set(parsed.data.entryIds).size) return NextResponse.json({ error: "One or more selected leads are invalid" }, { status: 400 })
  const deliveryId = newDeliveryId()
  const queued = await enqueueIntegrationDelivery({
    userId: session.user.id,
    connectionId: connection.id,
    listId: parsed.data.listId,
    entryIds: [...new Set(parsed.data.entryIds)],
    deliveryId,
    idempotencyKey: request.headers.get("Idempotency-Key"),
  })
  return NextResponse.json({
    jobId: queued.job.id,
    deliveryId: queued.deliveryId,
    status: "QUEUED",
    statusUrl: `/api/jobs/${queued.job.id}`,
  }, { status: 202 })
}
