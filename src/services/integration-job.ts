import { createHmac, randomUUID } from "node:crypto"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { createAndEnqueueJob, updateJobProgress } from "@/lib/jobs/service"
import { decryptIntegrationSecret } from "@/lib/integration-crypto"
import { publicLead } from "@/lib/public-lead"
import { readLimitedText, safeFetch } from "@/lib/safe-url"

const payloadSchema = z.object({
  userId: z.string().min(1),
  connectionId: z.string().min(1),
  listId: z.string().min(1),
  entryIds: z.array(z.string().min(1)).min(1).max(100),
  deliveryId: z.string().uuid(),
})

export async function enqueueIntegrationDelivery(input: z.infer<typeof payloadSchema> & {
  idempotencyKey?: string | null
}) {
  const job = await createAndEnqueueJob({
    userId: input.userId,
    kind: "INTEGRATION_DELIVERY",
    listId: input.listId,
    idempotencyKey: input.idempotencyKey || input.deliveryId,
    payload: JSON.parse(JSON.stringify(input)),
  })
  const actualPayload = payloadSchema.parse(job.payload)
  await prisma.integrationDelivery.upsert({
    where: { deliveryId: actualPayload.deliveryId },
    update: { jobRunId: job.id },
    create: {
      deliveryId: actualPayload.deliveryId,
      connectionId: actualPayload.connectionId,
      jobRunId: job.id,
    },
  })
  return { job, deliveryId: actualPayload.deliveryId }
}

export async function processIntegrationDelivery(jobRunId: string) {
  const job = await prisma.jobRun.findUnique({ where: { id: jobRunId } })
  if (!job) throw new Error("Integration delivery job not found")
  const payload = payloadSchema.parse(job.payload)
  const connection = await prisma.integrationConnection.findFirst({
    where: { id: payload.connectionId, userId: payload.userId, enabled: true },
  })
  if (!connection) throw new Error("Integration connection is unavailable")

  const entries = await prisma.leadListEntry.findMany({
    where: {
      id: { in: payload.entryIds },
      listId: payload.listId,
      list: { userId: payload.userId },
    },
    include: { lead: true, labels: { include: { label: true } } },
  })
  if (entries.length !== payload.entryIds.length) {
    throw new Error("One or more delivery leads are unavailable")
  }

  const delivery = await prisma.integrationDelivery.upsert({
    where: { deliveryId: payload.deliveryId },
    update: { status: "DELIVERING", attemptCount: { increment: 1 } },
    create: {
      deliveryId: payload.deliveryId,
      connectionId: connection.id,
      jobRunId,
      status: "DELIVERING",
      attemptCount: 1,
    },
  })
  await updateJobProgress(jobRunId, { stage: "Sending signed webhook", current: 1, total: 2 })

  const body = JSON.stringify({
    event: "pipeleads.leads.selected",
    deliveryId: payload.deliveryId,
    occurredAt: new Date().toISOString(),
    listId: payload.listId,
    leads: entries.map((entry) => ({
      entryId: entry.id,
      ...publicLead(entry.lead),
      labels: entry.labels.map(({ label }) => label.name),
    })),
  })
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const secret = decryptIntegrationSecret(connection)
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex")

  try {
    const response = await safeFetch(connection.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "PipeLeads-Webhook/1.0",
        "X-PipeLeads-Delivery": payload.deliveryId,
        "X-PipeLeads-Timestamp": timestamp,
        "X-PipeLeads-Signature": `sha256=${signature}`,
      },
      body,
    }, { timeoutMs: 15_000, maxRedirects: 0 })
    const responseBody = await readLimitedText(response, 16_384)
    if (!response.ok) throw new Error(`Webhook returned HTTP ${response.status}: ${responseBody.slice(0, 300)}`)
    await prisma.integrationDelivery.update({
      where: { id: delivery.id },
      data: { status: "DELIVERED", responseStatus: response.status, deliveredAt: new Date(), errorMessage: null },
    })
    await updateJobProgress(jobRunId, { stage: "Delivered", current: 2, total: 2 })
    return { deliveryId: payload.deliveryId, delivered: entries.length, responseStatus: response.status }
  } catch (error) {
    await prisma.integrationDelivery.update({
      where: { id: delivery.id },
      data: { status: "FAILED", errorMessage: error instanceof Error ? error.message.slice(0, 2_000) : "Delivery failed" },
    })
    throw error
  }
}

export function newDeliveryId() {
  return randomUUID()
}
