/**
 * The plugin frame's pure rules: the frame page's Content-Security-Policy, the
 * sandbox, and which messages the host acts on (the corrected origin rule:
 * a sandboxed frame's origin is opaque, so its messages arrive as "null").
 */
import { describe, expect, it } from "vitest"

import {
  PLUGIN_FRAME_SANDBOX,
  acceptsFrameMessage,
  clampFrameHeight,
  hostMessage,
  isNavigableResource,
  isPluginFramePath,
  originOfAppUrl,
  parseFrameMessage,
  pluginFrameCsp,
  safePluginOrigin,
} from "./plugin-frame"

const KEYCLOAK = ["https://auth.groovetech.io"]
const query = (origin?: string) => new URLSearchParams(origin === undefined ? "" : { origin })

describe("the frame page's policy", () => {
  it("applies to /plugins/<installId> and to no other page", () => {
    expect(isPluginFramePath("/plugins/install-1")).toBe(true)
    expect(isPluginFramePath("/plugins")).toBe(false)
    expect(isPluginFramePath("/plugins/install-1/extra")).toBe(false)
    expect(pluginFrameCsp("/plugins", query("https://plugin.example"), KEYCLOAK)).toBeNull()
    expect(pluginFrameCsp("/lead-search/saved-lists", query("https://plugin.example"), KEYCLOAK)).toBeNull()
  })

  it("allows the plugin's origin, this app and its sign-in provider, and nothing else", () => {
    expect(pluginFrameCsp("/plugins/install-1", query("https://plugin.example"), KEYCLOAK)).toBe("frame-src 'self' https://auth.groovetech.io https://plugin.example")
  })

  it("allows no third-party origin when the address names none or a malformed one", () => {
    for (const origin of [undefined, "", "https://plugin.example/path", "https://*.example", "https://a.example https://b.example", "https://a.example; script-src *", "javascript:alert(1)", "http://plugin.example", "'unsafe-inline'"]) {
      expect(pluginFrameCsp("/plugins/install-1", query(origin), KEYCLOAK)).toBe("frame-src 'self' https://auth.groovetech.io")
    }
  })

  it("accepts https origins, and http only on this machine", () => {
    expect(safePluginOrigin("https://plugin.example")).toBe("https://plugin.example")
    expect(safePluginOrigin("https://plugin.example:8443")).toBe("https://plugin.example:8443")
    expect(safePluginOrigin("http://localhost:3005")).toBe("http://localhost:3005")
    expect(safePluginOrigin("http://plugin.example")).toBeNull()
    expect(originOfAppUrl("https://plugin.example/app?x=1")).toBe("https://plugin.example")
    expect(originOfAppUrl("not a url")).toBeNull()
  })

  it("never grants the frame this app's origin", () => {
    expect(PLUGIN_FRAME_SANDBOX).toBe("allow-scripts allow-forms allow-popups allow-downloads")
    expect(PLUGIN_FRAME_SANDBOX).not.toContain("allow-same-origin")
  })
})

describe("the bridge", () => {
  const frameWindow = {}
  const pluginOrigin = "https://plugin.example"

  it("acts only on messages from the iframe's own window, with origin null or the plugin's", () => {
    expect(acceptsFrameMessage({ source: frameWindow, frameWindow, origin: "null", pluginOrigin })).toBe(true)
    expect(acceptsFrameMessage({ source: frameWindow, frameWindow, origin: pluginOrigin, pluginOrigin })).toBe(true)
    expect(acceptsFrameMessage({ source: {}, frameWindow, origin: "null", pluginOrigin })).toBe(false)
    expect(acceptsFrameMessage({ source: frameWindow, frameWindow, origin: "https://evil.example", pluginOrigin })).toBe(false)
    expect(acceptsFrameMessage({ source: null, frameWindow: null, origin: "null", pluginOrigin })).toBe(false)
  })

  it("reads only well-formed version 1 messages of the five frame types", () => {
    expect(parseFrameMessage({ scale: "plugin-bridge", version: "1", type: "scale.frame.ready" })).toEqual({ type: "scale.frame.ready", id: undefined, payload: undefined })
    expect(parseFrameMessage({ scale: "plugin-bridge", version: "1", type: "scale.frame.getPass", id: "7" })?.id).toBe("7")
    expect(parseFrameMessage({ scale: "plugin-bridge", version: "2", type: "scale.frame.ready" })).toBeNull()
    expect(parseFrameMessage({ scale: "other", version: "1", type: "scale.frame.ready" })).toBeNull()
    expect(parseFrameMessage({ scale: "plugin-bridge", version: "1", type: "scale.host.init" })).toBeNull()
    expect(parseFrameMessage("scale.frame.ready")).toBeNull()
  })

  it("answers in the same envelope, echoing the id", () => {
    expect(hostMessage("scale.host.pass", { pass: "p" }, "7")).toEqual({ scale: "plugin-bridge", version: "1", type: "scale.host.pass", id: "7", payload: { pass: "p" } })
    expect(hostMessage("scale.host.init", { pass: "p", app: "leadfinder", theme: "dark" })).not.toHaveProperty("id")
  })

  it("opens saved lists only, and keeps the frame's height within bounds", () => {
    expect(isNavigableResource("list")).toBe(true)
    expect(isNavigableResource("contact")).toBe(false)
    expect(clampFrameHeight(10)).toBe(240)
    expect(clampFrameHeight(99999)).toBe(6000)
    expect(clampFrameHeight("tall")).toBeNull()
  })
})
