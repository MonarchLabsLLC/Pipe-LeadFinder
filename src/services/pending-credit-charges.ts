/**
 * Background settlement of Micro charges that did not settle on the first
 * attempt (see settleCharge in credits-service.ts). Each row is retried with
 * its original idempotency key, so a charge Micro already applied is never
 * debited twice. 409s stay "owed" and are retried hourly until the customer
 * adds credits; other 4xx become "failed" for follow-up.
 */
import { prisma } from "@/lib/prisma"
import {
  postConsume,
  retryDelayMinutes,
  type ConsumeBody,
} from "@/services/credits-service"

const RETRY_INTERVAL_MS = 60_000
const BATCH_SIZE = 50
const CLAIM_MINUTES = 10

export async function retryDuePendingCreditCharges(limit = BATCH_SIZE) {
  const now = new Date()
  const due = await prisma.pendingCreditCharge.findMany({
    where: { status: { in: ["pending", "owed"] }, nextAttemptAt: { lte: now } },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
  })

  let attempted = 0
  let settled = 0
  for (const row of due) {
    // Claim the row so overlapping ticks or processes never send it twice at once.
    const claimed = await prisma.pendingCreditCharge.updateMany({
      where: { id: row.id, nextAttemptAt: row.nextAttemptAt, status: row.status },
      data: { nextAttemptAt: new Date(Date.now() + CLAIM_MINUTES * 60_000) },
    })
    if (!claimed.count) continue
    attempted += 1

    const outcome = await postConsume(
      row.creditUserId,
      row.email,
      row.payload as unknown as ConsumeBody
    )
    if (outcome.kind === "charged") {
      settled += 1
      await prisma.pendingCreditCharge.update({
        where: { id: row.id },
        data: {
          status: "settled",
          attempts: { increment: 1 },
          settledAt: new Date(),
          lastStatusCode: 200,
          lastError: null,
        },
      })
      continue
    }

    const status =
      outcome.kind === "owed" ? "owed" : outcome.kind === "retryable" ? "pending" : "failed"
    if (status === "failed") {
      console.error("[Credits] Pending charge permanently rejected by Micro:", {
        id: row.id,
        statusCode: outcome.statusCode,
        message: outcome.message,
      })
    }
    await prisma.pendingCreditCharge.update({
      where: { id: row.id },
      data: {
        status,
        attempts: { increment: 1 },
        lastStatusCode: outcome.statusCode,
        lastError: outcome.message.slice(0, 2000),
        nextAttemptAt: new Date(
          Date.now() +
            (status === "failed" ? 0 : retryDelayMinutes(row.attempts + 1, status)) * 60_000
        ),
      },
    })
  }
  return { attempted, settled }
}

type WorkerGlobal = typeof globalThis & { pipeLeadsPendingChargeWorker?: boolean }

export function startPendingCreditChargeWorker() {
  const g = globalThis as WorkerGlobal
  if (g.pipeLeadsPendingChargeWorker) return
  g.pipeLeadsPendingChargeWorker = true
  const tick = async () => {
    try {
      const result = await retryDuePendingCreditCharges()
      if (result.attempted > 0) console.log("[Credits] Retried pending charges:", result)
    } catch (error) {
      console.warn("[Credits] Pending charge retry failed; will retry:", (error as Error).message)
    }
    setTimeout(tick, RETRY_INTERVAL_MS).unref()
  }
  setTimeout(tick, 15_000).unref()
}
