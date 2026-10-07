import { prisma } from "@/lib/prisma"
import type { Prisma } from "@/generated/prisma/client"

import { pluginsEnabled } from "./env"
import { PLUGIN_ACTION_EVENT_PREFIX } from "./contract"

// Events for the ScalePlus dashboard start here, as rows in PluginEventOutbox.
// forwarder.ts sends them. Three rules:
//
//   * queueing NEVER throws: a broken outbox must not fail the search, the
//     enrichment job or the approval that caused the event
//   * with the channel off nothing is written at all
//   * payloads carry ids and counts only, never a lead's name, email or phone
//
// The hooks (the only places that call these):
//   leadfinder.search.completed      src/services/search-job.ts (a search job finished)
//                                    src/services/agent-runner.ts (an AI Agent's search finished)
//   leadfinder.list.updated          the same two places when leads were saved, and
//                                    src/server/plugins/changes.ts (a plugin changed labels)
//   leadfinder.enrichment.completed  src/services/bulk-job.ts (enrichment or scoring finished)
//   leadfinder.action.*              src/server/plugins/changes.ts (a proposal's outcome)

export type PluginDomainEvent =
  | { type: "leadfinder.search.completed"; data: { searchId: string; listId: string; searchType: string; resultCount: number; jobId?: string; agentId?: string } }
  | { type: "leadfinder.list.updated"; data: { listId: string; reason: "leads_added" | "labels_changed"; count: number } }
  | { type: "leadfinder.enrichment.completed"; data: { jobId: string; listId: string; kind: "email" | "phone" | "score"; attempted: number; succeeded: number; failed: number } }

export type PluginActionOutcome = "approved" | "rejected" | "expired"

/** Hook for forwarder.ts: try to send soon after queueing. Set once, at module load there. */
let kick: (() => void) | null = null
export function onPluginEventQueued(listener: (() => void) | null): void {
  kick = listener
}

async function insert(userId: string, type: string, data: unknown, occurredAt?: Date): Promise<void> {
  if (!pluginsEnabled()) return
  try {
    await prisma.pluginEventOutbox.create({
      data: { userId, type, data: JSON.parse(JSON.stringify(data ?? {})) as Prisma.InputJsonValue, ...(occurredAt ? { occurredAt } : {}) },
    })
  } catch (error) {
    console.error("[plugins] could not queue an event", type, error instanceof Error ? error.message : error)
    return
  }
  try {
    if (kick) kick()
    else void import("./forwarder").then((forwarder) => forwarder.kickPluginForwarder()).catch(() => {})
  } catch {
    // Sending is best-effort here; the scheduled pass will pick the row up.
  }
}

/** Queue one domain event for the owner `userId`. Never throws. */
export async function queuePluginEvent(userId: string, event: PluginDomainEvent, occurredAt?: Date): Promise<void> {
  await insert(userId, event.type, event.data, occurredAt)
}

/** Queue a proposal's outcome, addressed to the install that asked. Never throws. */
export async function queuePluginActionOutcome(
  userId: string,
  outcome: PluginActionOutcome,
  data: { proposalId: string; installId: string; status?: "executed" | "failed"; result?: unknown }
): Promise<void> {
  await insert(userId, `${PLUGIN_ACTION_EVENT_PREFIX}${outcome}`, data)
}

export function isPluginActionEvent(type: string): boolean {
  return type.startsWith(PLUGIN_ACTION_EVENT_PREFIX)
}
