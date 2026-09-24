/**
 * Browser side of the one-click handoff: chunked sending, remembered choices
 * and the result toasts. No React here, so it can be tested on its own.
 */

import { toast } from "sonner"

export type HandoffTargetName = "pipeleads" | "mailbaser"

export const TARGET_LABEL: Record<HandoffTargetName, string> = {
  pipeleads: "PipeLeads",
  mailbaser: "MailBaser",
}

export const HANDOFF_BATCH_SIZE = 50

export type HandoffCounts = { created: number; updated: number; skipped: number }

export type HandoffSendResult = {
  counts: HandoffCounts
  openUrl: string | null
  /** Set when a batch failed; earlier batches may already have gone through. */
  error: string | null
}

export function chunk<T>(items: T[], size = HANDOFF_BATCH_SIZE): T[][] {
  const batches: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size))
  }
  return batches
}

async function readError(response: Response): Promise<string> {
  const body = await response.json().catch(() => null)
  const error = body?.error
  if (typeof error === "string") return error
  if (error && typeof error.message === "string") return error.message
  return `The request failed with status ${response.status}.`
}

/** Sends batches of 50 one after another and adds up the counts. */
export async function sendLeadsInBatches(
  target: HandoffTargetName,
  leadIds: string[],
  options: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch
): Promise<HandoffSendResult> {
  const counts: HandoffCounts = { created: 0, updated: 0, skipped: 0 }
  let openUrl: string | null = null
  for (const batch of chunk([...new Set(leadIds)])) {
    const response = await fetchImpl(`/api/handoff/${target}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...options, leadIds: batch }),
    })
    if (!response.ok) {
      return { counts, openUrl, error: await readError(response) }
    }
    const data = await response.json()
    counts.created += data.counts?.created ?? 0
    counts.updated += data.counts?.updated ?? 0
    counts.skipped += data.counts?.skipped ?? 0
    openUrl = typeof data.openUrl === "string" ? data.openUrl : openUrl
  }
  return { counts, openUrl, error: null }
}

export async function fetchHandoffOptions<T>(target: HandoffTargetName): Promise<T> {
  const response = await fetch(`/api/handoff/${target}/options`)
  if (!response.ok) throw new Error(await readError(response))
  return response.json()
}

export function summarize(target: HandoffTargetName, counts: HandoffCounts): string {
  const added = counts.created + counts.updated
  return `Added ${added} to ${TARGET_LABEL[target]}: ${counts.created} new, ${counts.updated} updated, ${counts.skipped} skipped`
}

function openAction(openUrl: string | null) {
  if (!openUrl) return undefined
  return {
    label: "Open",
    onClick: () => window.open(openUrl, "_blank", "noopener,noreferrer"),
  }
}

export function toastHandoffResult(target: HandoffTargetName, result: HandoffSendResult) {
  const label = TARGET_LABEL[target]
  const sentSome = result.counts.created + result.counts.updated + result.counts.skipped > 0
  if (result.error) {
    toast.error(`Not sent to ${label}`, {
      description: sentSome
        ? `${result.error} ${summarize(target, result.counts)} before the error.`
        : result.error,
      action: sentSome ? openAction(result.openUrl) : undefined,
    })
    return
  }
  const added = result.counts.created + result.counts.updated
  const show = added > 0 ? toast.success : toast.info
  show(summarize(target, result.counts), {
    description:
      added === 0
        ? target === "mailbaser"
          ? "Nothing was added. MailBaser needs an email address for each lead."
          : "Nothing was added."
        : undefined,
    action: openAction(result.openUrl),
  })
}

// ── Remembered choices (per user, per browser) ──────────────────────────

export function prefsKey(target: HandoffTargetName, userId: string | null | undefined) {
  return `leadfinder:handoff:${target}:${userId || "anonymous"}`
}

export function readPrefs<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function writePrefs(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Private mode or storage full: the choice simply is not remembered.
  }
}
