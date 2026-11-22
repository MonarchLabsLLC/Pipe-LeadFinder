import { prisma } from "@/lib/prisma"

import { pluginsEnabled } from "./env"
import { queuePluginEvent, type PluginDomainEvent } from "./events"

// Turning a finished background job into plugin events. Pure where it can be
// (eventsForJob), so the payloads are tested: ids and counts, nothing else.

export interface FinishedJob {
  id: string
  kind: string
  listId: string | null
  searchId: string | null
  result: unknown
}

const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : 0)

/** The events one completed job stands for. */
export function eventsForJob(job: FinishedJob, searchType?: string | null): PluginDomainEvent[] {
  const result = (job.result ?? {}) as Record<string, unknown>
  if (!job.listId) return []
  if (job.kind === "SEARCH") {
    if (!job.searchId) return []
    const resultCount = count(result.resultCount)
    return [
      { type: "leadfinder.search.completed", data: { searchId: job.searchId, listId: job.listId, searchType: searchType ?? "UNKNOWN", resultCount, jobId: job.id } },
      ...(resultCount > 0 ? [{ type: "leadfinder.list.updated" as const, data: { listId: job.listId, reason: "leads_added" as const, count: resultCount } }] : []),
    ]
  }
  const kind = job.kind === "BULK_ENRICH_EMAIL" ? "email" : job.kind === "BULK_ENRICH_PHONE" ? "phone" : job.kind === "BULK_SCORE" ? "score" : null
  if (!kind) return []
  return [
    {
      type: "leadfinder.enrichment.completed",
      data: { jobId: job.id, listId: job.listId, kind, attempted: count(result.attempted), succeeded: count(kind === "score" ? result.scoredCount : result.enriched), failed: count(result.failed) },
    },
  ]
}

/**
 * Called by the job workers after a search, enrichment or scoring job has
 * completed. Never throws, and does nothing at all with the channel off.
 */
export async function reportJobCompleted(jobRunId: string): Promise<void> {
  if (!pluginsEnabled()) return
  try {
    const job = await prisma.jobRun.findUnique({
      where: { id: jobRunId },
      select: { id: true, kind: true, status: true, userId: true, listId: true, searchId: true, result: true, search: { select: { searchType: true } } },
    })
    if (!job || job.status !== "COMPLETED") return
    for (const event of eventsForJob(job, job.search?.searchType)) await queuePluginEvent(job.userId, event)
  } catch (error) {
    console.error("[plugins] could not report a finished job", error instanceof Error ? error.message : error)
  }
}

/** An AI Agent run (an AGENT_RUN job) completed. Never throws; nothing with the channel off. */
export async function reportAgentRunCompleted(jobRunId: string): Promise<void> {
  if (!pluginsEnabled()) return
  try {
    const job = await prisma.jobRun.findUnique({
      where: { id: jobRunId },
      select: { id: true, kind: true, status: true, userId: true, agentId: true, listId: true, searchId: true, result: true },
    })
    const event = job ? eventForAgentRun(job) : null
    if (job && event) await queuePluginEvent(job.userId, event)
  } catch (error) {
    console.error("[plugins] could not report an agent run", error instanceof Error ? error.message : error)
  }
}

/** Pure: the event one finished AGENT_RUN job stands for, or null. */
export function eventForAgentRun(job: { id: string; kind: string; status: string; agentId: string | null; listId: string | null; searchId: string | null; result: unknown }): PluginDomainEvent | null {
  if (job.kind !== "AGENT_RUN" || job.status !== "COMPLETED" || !job.agentId) return null
  const result = (job.result ?? {}) as Record<string, unknown>
  return {
    type: "leadfinder.agent.run_completed",
    data: {
      agentId: job.agentId,
      jobId: job.id,
      listId: job.listId,
      searchId: job.searchId,
      leadCount: count(result.leadCount),
      totalLeadCount: count(result.totalLeadCount),
    },
  }
}

/** An AI Agent's own search finished (it is not a SEARCH job). Never throws. */
export async function reportAgentSearchCompleted(input: { userId: string; agentId: string; searchId: string; listId: string | null; searchType: string; resultCount: number }): Promise<void> {
  if (!pluginsEnabled() || !input.listId) return
  try {
    await queuePluginEvent(input.userId, {
      type: "leadfinder.search.completed",
      data: { searchId: input.searchId, listId: input.listId, searchType: input.searchType, resultCount: count(input.resultCount), agentId: input.agentId },
    })
    if (input.resultCount > 0) {
      await queuePluginEvent(input.userId, { type: "leadfinder.list.updated", data: { listId: input.listId, reason: "leads_added", count: count(input.resultCount) } })
    }
  } catch (error) {
    console.error("[plugins] could not report an agent search", error instanceof Error ? error.message : error)
  }
}
