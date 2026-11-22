// The Scale Plugin Store channel is driven by environment variable NAMES, like
// the Lead Finder Agent. With SCALE_PLUGINS_ENABLED unset every
// /api/plugins/service/v1 route answers 404, nothing is queued for the
// dashboard and the Plugins page is not shown. docs/Scale-Plugin-Channel.md
// lists every variable.

function text(name: string): string {
  return process.env[name]?.trim() ?? ""
}

function flag(name: string): boolean {
  const raw = text(name).toLowerCase()
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on"
}

/** Shortest shared secret that switches the channel on (contract section 3). */
export const MIN_PLUGIN_SECRET_BYTES = 32

export const DEFAULT_PLUGIN_GATEWAY_URL = "https://app.scaleplus.gg"

/** The HS256 key shared with the ScalePlus dashboard, both directions. */
export function pluginServiceSecret(): string {
  return text("SCALE_PLUGIN_SERVICE_SECRET")
}

/** The dashboard's base URL, no trailing slash. */
export function pluginGatewayUrl(): string {
  return (text("SCALE_PLUGIN_GATEWAY_URL") || DEFAULT_PLUGIN_GATEWAY_URL).replace(/\/+$/, "")
}

/**
 * The whole channel: the flag AND a usable secret. A flag with no secret is
 * treated as off, so a half-configured deployment never accepts a call it
 * cannot verify and never queues events it cannot sign.
 */
export function pluginsEnabled(): boolean {
  if (!flag("SCALE_PLUGINS_ENABLED")) return false
  return Buffer.byteLength(pluginServiceSecret(), "utf8") >= MIN_PLUGIN_SECRET_BYTES
}
