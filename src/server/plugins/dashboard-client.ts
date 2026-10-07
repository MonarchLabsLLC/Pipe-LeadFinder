import { pluginGatewayUrl, pluginServiceSecret } from "./env"
import { signAppToken } from "./token"

// The three calls this app makes to the ScalePlus dashboard (contract section
// 5), each signed with the app-to-dashboard service JWT over the exact bytes
// sent. Nothing here reads or writes the database.

export const DASHBOARD_INTERNAL_ROOT = "/api/platform/internal"
const DEFAULT_TIMEOUT_MS = 8_000

export class DashboardError extends Error {
  constructor(
    message: string,
    readonly status: number | null
  ) {
    super(message)
    this.name = "DashboardError"
  }
}

type Fetcher = typeof fetch

export async function dashboardPost<T>(
  route: "events" | "installs" | "frame-pass",
  body: unknown,
  options: { timeoutMs?: number; fetcher?: Fetcher } = {}
): Promise<T> {
  const path = `${DASHBOARD_INTERNAL_ROOT}/${route}`
  const rawBody = JSON.stringify(body)
  const { token, requestId } = await signAppToken({ secret: pluginServiceSecret(), method: "POST", path, rawBody })

  let response: Response
  try {
    response = await (options.fetcher ?? fetch)(`${pluginGatewayUrl()}${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "x-request-id": requestId },
      body: rawBody,
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    })
  } catch (error) {
    throw new DashboardError(`The ScalePlus dashboard did not answer (${error instanceof Error ? error.name : "error"}).`, null)
  }
  if (!response.ok) throw new DashboardError(`The ScalePlus dashboard answered ${response.status}.`, response.status)
  try {
    return (await response.json()) as T
  } catch {
    throw new DashboardError("The ScalePlus dashboard sent an answer that is not JSON.", response.status)
  }
}

// ---------------------------------------------------------------------------
// Installs, cached for 60 seconds per owner
// ---------------------------------------------------------------------------

export interface PluginInstall {
  installId: string
  pluginId: string
  name: string
  description: string | null
  iconUrl: string | null
  appUrl: string | null
}

export const INSTALLS_CACHE_MS = 60_000
const MAX_CACHED_OWNERS = 5_000

const installsCache = new Map<string, { at: number; installs: PluginInstall[] }>()

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null
}

function toInstalls(payload: unknown): PluginInstall[] {
  const list = (payload as { installs?: unknown } | null)?.installs
  if (!Array.isArray(list)) return []
  return list.flatMap((entry) => {
    const row = entry as Record<string, unknown> | null
    const installId = text(row?.installId)
    const pluginId = text(row?.pluginId)
    if (!installId || !pluginId) return []
    return [{ installId, pluginId, name: text(row?.name) ?? "Plugin", description: text(row?.description), iconUrl: text(row?.iconUrl), appUrl: text(row?.appUrl) }]
  })
}

/**
 * The active installs in this owner's ScalePlus workspace that hold any scope
 * for this app. The answer is kept for 60 seconds per process (the contract's
 * limit); `fresh` skips the cache for a person looking at the Plugins page.
 */
export async function installsForOwner(
  ownerSubject: string,
  options: { now?: number; fresh?: boolean; fetcher?: Fetcher } = {}
): Promise<PluginInstall[]> {
  const now = options.now ?? Date.now()
  const hit = installsCache.get(ownerSubject)
  if (!options.fresh && hit && now - hit.at < INSTALLS_CACHE_MS) return hit.installs

  const installs = toInstalls(await dashboardPost("installs", { ownerSubject }, { fetcher: options.fetcher }))
  if (installsCache.size >= MAX_CACHED_OWNERS) installsCache.clear()
  installsCache.set(ownerSubject, { at: now, installs })
  return installs
}

/** Tests: forget every cached answer. */
export function resetInstallsCache(): void {
  installsCache.clear()
}

// ---------------------------------------------------------------------------
// Events and the frame pass
// ---------------------------------------------------------------------------

export interface OutboundPluginEvent {
  id: string
  type: string
  occurredAt: string
  ownerSubject: string
  tenantId: string
  data: unknown
}

/** At most 100 per call (contract section 5). */
export const MAX_EVENTS_PER_CALL = 100

export async function sendPluginEvents(events: OutboundPluginEvent[], options: { fetcher?: Fetcher } = {}): Promise<number> {
  if (events.length === 0) return 0
  const answer = await dashboardPost<{ accepted?: number }>("events", { events }, { fetcher: options.fetcher })
  return typeof answer?.accepted === "number" ? answer.accepted : events.length
}

export interface FramePass {
  pass: string
  expiresIn: number
  appUrl: string
  pluginOrigin: string
}

export async function requestFramePass(
  body: { installId: string; ownerSubject: string; tenantId: string | null; viewer: { subject: string; name: string; role: "owner" | "admin" | "member" } },
  options: { fetcher?: Fetcher } = {}
): Promise<FramePass> {
  const answer = await dashboardPost<Partial<FramePass>>("frame-pass", body, { fetcher: options.fetcher })
  const pass = text(answer?.pass)
  const appUrl = text(answer?.appUrl)
  const pluginOrigin = text(answer?.pluginOrigin)
  if (!pass || !appUrl || !pluginOrigin) throw new DashboardError("The ScalePlus dashboard sent an incomplete frame pass.", 200)
  return { pass, appUrl, pluginOrigin, expiresIn: typeof answer.expiresIn === "number" ? answer.expiresIn : 60 }
}
