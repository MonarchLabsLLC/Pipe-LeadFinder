import { prisma } from "@/lib/prisma"

import { expirePluginProposals } from "./changes"
import { GATEWAY_ISSUER } from "./contract"
import { MAX_EVENTS_PER_CALL, installsForOwner, sendPluginEvents, type OutboundPluginEvent } from "./dashboard-client"
import { pluginsEnabled } from "./env"
import { isPluginActionEvent } from "./events"

// Forwarding the plugin outbox to the ScalePlus dashboard
// (POST {SCALE_PLUGIN_GATEWAY_URL}/api/platform/internal/events).
//
// The queue is the PluginEventOutbox table. It is drained in two ways:
//
//   1. right after an event is queued, in the background of the same process
//      (kickPluginForwarder), so a healthy dashboard hears within a second
//   2. on every scheduled-agents tick (POST /api/ai/agent/run-scheduled, the
//      app's existing cron), which is what retries anything that failed
//
// Either way the request or job that caused the event has already finished its
// own work: a slow or broken dashboard can never fail it.
//
//   * an event is sent only for an owner with at least one install of a plugin
//     that holds a scope for this app (asked once per owner, kept 60 seconds);
//     everybody else's rows are deleted unsent
//   * a failed send is retried after 1, 5, 15 and 60 minutes and then 6 hours,
//     on the next tick after that time; the sixth failure marks the row FAILED
//     and it is left for an operator
//   * a delivered row is deleted. Passes may overlap, so the same event can be
//     sent twice; the dashboard de-duplicates on (app, id)
//
// Proposal outcomes (leadfinder.action.*) skip the install check: they are
// addressed to the one install that asked, whatever it subscribes to.

export const PLUGIN_RETRY_DELAYS_SECONDS = [60, 300, 900, 3600, 21_600] as const
export const PLUGIN_MAX_ATTEMPTS = PLUGIN_RETRY_DELAYS_SECONDS.length + 1

/** When to try again after `attempts` failures, or null when that was the last. */
export function nextPluginAttempt(attempts: number, now: Date): Date | null {
  if (attempts >= PLUGIN_MAX_ATTEMPTS) return null
  const delay = PLUGIN_RETRY_DELAYS_SECONDS[Math.max(1, attempts) - 1]
  return new Date(now.getTime() + delay * 1000)
}

export interface ForwardReport {
  delivered: number
  /** Deleted unsent: the owner has no installs, or no ScalePlus identity. */
  dropped: number
  failed: number
  expiredProposals: number
}

interface Row {
  id: string
  userId: string
  type: string
  occurredAt: Date
  data: unknown
  attempts: number
}

async function removeRows(ids: string[]): Promise<void> {
  if (ids.length > 0) await prisma.pluginEventOutbox.deleteMany({ where: { id: { in: ids } } })
}

async function failRows(rows: Row[], error: unknown, now: Date): Promise<void> {
  const message = (error instanceof Error ? error.message : String(error)).slice(0, 500)
  for (const row of rows) {
    const attempts = row.attempts + 1
    const next = nextPluginAttempt(attempts, now)
    await prisma.pluginEventOutbox.updateMany({
      where: { id: row.id },
      data: { attempts, lastError: message, nextAttemptAt: next, status: next ? "PENDING" : "FAILED" },
    })
  }
}

function toEvent(row: Row, ownerSubject: string): OutboundPluginEvent {
  // A Lead Finder account is its owner's: the tenant id is the owner's User.id.
  return { id: row.id, type: row.type, occurredAt: row.occurredAt.toISOString(), ownerSubject, tenantId: row.userId, data: row.data ?? {} }
}

/**
 * One bounded pass. Never throws: whatever goes wrong is counted and logged,
 * and the rows wait for the next pass.
 */
export async function forwardPluginEvents(options: { limit?: number; now?: Date; housekeeping?: boolean } = {}): Promise<ForwardReport> {
  const report: ForwardReport = { delivered: 0, dropped: 0, failed: 0, expiredProposals: 0 }
  if (!pluginsEnabled()) return report
  const now = options.now ?? new Date()

  try {
    if (options.housekeeping) {
      // First, so an expiry found now is forwarded in this same pass.
      report.expiredProposals = await expirePluginProposals(now)
      // Spent service-token nonces from the gateway (they live 35 seconds).
      await prisma.focusedAgentNonce.deleteMany({ where: { issuer: GATEWAY_ISSUER, expiresAt: { lt: new Date(now.getTime() - 60_000) } } })
    }

    const rows: Row[] = await prisma.pluginEventOutbox.findMany({
      where: { status: "PENDING", OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: Math.min(Math.max(options.limit ?? 200, 1), 500),
      select: { id: true, userId: true, type: true, occurredAt: true, data: true, attempts: true },
    })

    const byOwner = new Map<string, Row[]>()
    for (const row of rows) byOwner.set(row.userId, [...(byOwner.get(row.userId) ?? []), row])

    for (const [userId, group] of byOwner) {
      const owner = await prisma.user.findUnique({ where: { id: userId }, select: { keycloakSubId: true } })
      const subject = owner?.keycloakSubId
      // Nobody at ScalePlus can have installed a plugin for this account.
      if (!subject) {
        await removeRows(group.map((row) => row.id))
        report.dropped += group.length
        continue
      }

      const outcomes = group.filter((row) => isPluginActionEvent(row.type))
      let domain = group.filter((row) => !isPluginActionEvent(row.type))

      if (domain.length > 0) {
        try {
          const installs = await installsForOwner(subject)
          if (installs.length === 0) {
            await removeRows(domain.map((row) => row.id))
            report.dropped += domain.length
            domain = []
          }
        } catch (error) {
          await failRows(domain, error, now)
          report.failed += domain.length
          domain = []
        }
      }

      const sendable = [...outcomes, ...domain]
      for (let start = 0; start < sendable.length; start += MAX_EVENTS_PER_CALL) {
        const batch = sendable.slice(start, start + MAX_EVENTS_PER_CALL)
        try {
          await sendPluginEvents(batch.map((row) => toEvent(row, subject)))
          await removeRows(batch.map((row) => row.id))
          report.delivered += batch.length
        } catch (error) {
          await failRows(batch, error, now)
          report.failed += batch.length
        }
      }
    }
  } catch (error) {
    console.error("[plugins] event forwarding failed", error instanceof Error ? error.message : error)
  }
  return report
}

let running = false
let again = false

/**
 * Send what is waiting, soon, without anyone waiting for it. One pass at a
 * time per process; a kick during a pass runs one more afterwards.
 */
export function kickPluginForwarder(): void {
  if (!pluginsEnabled()) return
  if (running) {
    again = true
    return
  }
  running = true
  void (async () => {
    try {
      do {
        again = false
        await forwardPluginEvents({ limit: 100 })
      } while (again)
    } finally {
      running = false
    }
  })()
}
