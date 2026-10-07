// The plugin frame's shared, pure pieces: the bridge's message shape, the
// Content-Security-Policy for the frame page and the origin checks. No server
// or browser imports, so the proxy, the page and the tests all use it.
// Contract: "Scale Plugin Platform: wire contracts", section 8.

export const PLUGIN_BRIDGE = "plugin-bridge"
export const PLUGIN_BRIDGE_VERSION = "1"
/** Never allow-same-origin: the frame must stay in an opaque origin. */
export const PLUGIN_FRAME_SANDBOX = "allow-scripts allow-forms allow-popups allow-downloads"
/** The query parameter that carries the plugin's origin to the proxy for the CSP header. */
export const PLUGIN_ORIGIN_PARAM = "origin"

const FRAME_PAGE = /^\/plugins\/[^/]+\/?$/

/** `/plugins/<installId>`: the one page that frames third-party content. */
export function isPluginFramePath(pathname: string): boolean {
  return FRAME_PAGE.test(pathname) && !pathname.startsWith("/plugins/proposals")
}

/**
 * A plugin origin as it may appear in a CSP header: `https://host[:port]` and
 * nothing else (no path, no wildcard, no credentials, nothing that could add a
 * second source or a second directive). http is allowed for localhost only, so
 * a developer can frame a plugin running on their own machine.
 */
export function safePluginOrigin(value: string | null | undefined): string | null {
  if (!value || value.length > 300 || /[\s;,'"*]/.test(value)) return null
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.origin !== value) return null
  if (url.protocol === "https:") return url.origin
  if (url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) return url.origin
  return null
}

/** The origin of a plugin's app URL, when it is one this app will frame. */
export function originOfAppUrl(appUrl: string | null | undefined): string | null {
  if (!appUrl) return null
  try {
    return safePluginOrigin(new URL(appUrl).origin)
  } catch {
    return null
  }
}

/**
 * The Content-Security-Policy header for a request, or null when the page is
 * not the frame page. On the frame page `frame-src` is the plugin's origin plus
 * what the app's own shell needs ('self' and the sign-in provider); with no (or
 * a malformed) origin no third-party origin is allowed at all, so the page can
 * frame no plugin until it has been loaded with the right one.
 *
 * The origin comes from the query string, which a visitor controls, so it can
 * only ever NARROW what may be framed: the page itself renders the iframe only
 * when the dashboard's own `pluginOrigin` for that install equals it.
 */
export function pluginFrameCsp(pathname: string, searchParams: URLSearchParams, shellOrigins: readonly string[] = []): string | null {
  if (!isPluginFramePath(pathname)) return null
  const origin = safePluginOrigin(searchParams.get(PLUGIN_ORIGIN_PARAM))
  // What this app's own shell frames on every page: its silent sign-in check
  // ('self') and the sign-in provider's session frame. Nothing else.
  const shell = ["'self'", ...shellOrigins.map((value) => safePluginOrigin(value)).filter((value): value is string => value !== null)]
  return `frame-src ${[...new Set([...shell, ...(origin ? [origin] : [])])].join(" ")}`
}

// ---------------------------------------------------------------------------
// The bridge
// ---------------------------------------------------------------------------

export type FrameMessageType = "scale.frame.ready" | "scale.frame.getPass" | "scale.frame.navigate" | "scale.frame.toast" | "scale.frame.resize"

export interface FrameMessage {
  type: FrameMessageType
  id?: string
  payload?: Record<string, unknown>
}

const FRAME_TYPES = new Set<string>(["scale.frame.ready", "scale.frame.getPass", "scale.frame.navigate", "scale.frame.toast", "scale.frame.resize"])

/**
 * Whether the host may act on a message event. The frame is sandboxed without
 * allow-same-origin, so its origin is opaque and its messages arrive with
 * `origin === "null"`; what identifies it is its window. So: the source must
 * be the iframe's own contentWindow, and the origin "null" or the plugin's.
 */
export function acceptsFrameMessage(input: { source: unknown; frameWindow: unknown; origin: string; pluginOrigin: string }): boolean {
  if (!input.frameWindow || input.source !== input.frameWindow) return false
  return input.origin === "null" || input.origin === input.pluginOrigin
}

/** A well-formed bridge message from the frame, or null. */
export function parseFrameMessage(data: unknown): FrameMessage | null {
  if (!data || typeof data !== "object") return null
  const message = data as Record<string, unknown>
  if (message.scale !== PLUGIN_BRIDGE || message.version !== PLUGIN_BRIDGE_VERSION) return null
  if (typeof message.type !== "string" || !FRAME_TYPES.has(message.type)) return null
  const payload = message.payload && typeof message.payload === "object" && !Array.isArray(message.payload) ? (message.payload as Record<string, unknown>) : undefined
  return { type: message.type as FrameMessageType, id: typeof message.id === "string" ? message.id.slice(0, 200) : undefined, payload }
}

export function hostMessage(type: "scale.host.init" | "scale.host.pass", payload: Record<string, unknown>, id?: string) {
  return { scale: PLUGIN_BRIDGE, version: PLUGIN_BRIDGE_VERSION, type, ...(id ? { id } : {}), payload }
}

/** The records `scale.frame.navigate` may open here. Anything else is ignored. */
export const NAVIGABLE_RESOURCES = ["list"] as const
export type NavigableResource = (typeof NAVIGABLE_RESOURCES)[number]

export function isNavigableResource(value: unknown): value is NavigableResource {
  return typeof value === "string" && (NAVIGABLE_RESOURCES as readonly string[]).includes(value)
}

export const FRAME_MIN_HEIGHT = 240
export const FRAME_MAX_HEIGHT = 6000

export function clampFrameHeight(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  return Math.min(FRAME_MAX_HEIGHT, Math.max(FRAME_MIN_HEIGHT, Math.round(value)))
}
