"use client"

import * as React from "react"
import { ArrowLeft, Puzzle } from "lucide-react"
import { useTheme } from "next-themes"
import { toast } from "sonner"

import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import {
  FRAME_MIN_HEIGHT,
  PLUGIN_FRAME_SANDBOX,
  PLUGIN_ORIGIN_PARAM,
  acceptsFrameMessage,
  clampFrameHeight,
  hostMessage,
  isNavigableResource,
  isPluginFramePath,
  parseFrameMessage,
} from "@/lib/plugin-frame"

// /plugins/<installId>: one third-party plugin in a sandboxed, cross-origin
// iframe, and the host side of the bridge (wire contract, section 8).
//
//   * sandbox has no allow-same-origin, so the frame runs in an opaque origin
//     with no access to this app's cookies, storage or DOM
//   * the page is served with `Content-Security-Policy: frame-src …` naming the
//     plugin's origin (src/proxy.ts), which needs a full page load at the URL
//     that names the origin; a soft navigation here is turned into one
//   * the frame pass is fetched from this app's server and handed over by
//     postMessage, never in a URL
//   * a message is acted on only when it comes from this iframe's own window
//     (its origin reads "null" because of the sandbox); the host posts with
//     target "*" to that one window, since an opaque origin cannot be named

interface PluginFrameData {
  installId: string
  name: string
  pass: string
  expiresIn: number
  appUrl: string
  pluginOrigin: string
  app: string
}

type State = { phase: "loading" } | { phase: "reloading" } | { phase: "error"; message: string } | { phase: "ready"; frame: PluginFrameData }

/** Whether this document was loaded, by the browser, at exactly this address. */
function loadedAtThisUrl(): boolean {
  const entry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined
  return entry !== undefined && entry.name === window.location.href
}

async function fetchFrame(installId: string): Promise<PluginFrameData> {
  const response = await fetch(`/api/plugins/installs/${encodeURIComponent(installId)}/frame-pass`, { method: "POST" })
  const body = (await response.json().catch(() => null)) as (PluginFrameData & { error?: string }) | null
  if (!response.ok || !body?.pass) throw new Error(body?.error || "This plugin could not be opened.")
  return body
}

export function PluginFrame({ installId }: { installId: string }) {
  const [state, setState] = React.useState<State>({ phase: "loading" })
  const [height, setHeight] = React.useState<number | null>(null)
  const frameRef = React.useRef<HTMLIFrameElement>(null)
  const { resolvedTheme } = useTheme()
  const theme = resolvedTheme === "dark" ? "dark" : "light"
  const themeRef = React.useRef(theme)
  React.useEffect(() => {
    themeRef.current = theme
  }, [theme])

  React.useEffect(() => {
    let cancelled = false
    fetchFrame(installId)
      .then((frame) => {
        if (cancelled) return
        const url = new URL(window.location.href)
        // The policy header was computed from the address. Unless this very
        // document was loaded at the address naming this plugin's origin, load
        // it again there, so the header in force allows that origin.
        if (url.searchParams.get(PLUGIN_ORIGIN_PARAM) !== frame.pluginOrigin || !loadedAtThisUrl()) {
          url.searchParams.set(PLUGIN_ORIGIN_PARAM, frame.pluginOrigin)
          setState({ phase: "reloading" })
          window.location.replace(url.toString())
          return
        }
        setState({ phase: "ready", frame })
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ phase: "error", message: error instanceof Error ? error.message : "This plugin could not be opened." })
      })
    return () => {
      cancelled = true
    }
  }, [installId])

  const frame = state.phase === "ready" ? state.frame : null

  React.useEffect(() => {
    if (!frame) return

    const post = (message: unknown) => {
      // Only ever to this iframe's own window. "*" because a sandboxed frame's
      // origin is opaque: a named target origin would never be delivered.
      frameRef.current?.contentWindow?.postMessage(message, "*")
    }

    const onMessage = (event: MessageEvent) => {
      if (!acceptsFrameMessage({ source: event.source, frameWindow: frameRef.current?.contentWindow, origin: event.origin, pluginOrigin: frame.pluginOrigin })) return
      const message = parseFrameMessage(event.data)
      if (!message) return

      switch (message.type) {
        case "scale.frame.ready":
          // A pass lives 60 seconds, so the frame gets a fresh one, not the one this page loaded with.
          void fetchFrame(installId)
            .then((fresh) => post(hostMessage("scale.host.init", { pass: fresh.pass, app: fresh.app, theme: themeRef.current })))
            .catch(() => toast.error("This plugin could not be signed in. Reload the page to try again."))
          return
        case "scale.frame.getPass":
          void fetchFrame(installId)
            .then((fresh) => post(hostMessage("scale.host.pass", { pass: fresh.pass }, message.id)))
            .catch(() => {})
          return
        case "scale.frame.navigate": {
          const resource = message.payload?.resource
          const id = message.payload?.id
          if (!isNavigableResource(resource) || typeof id !== "string" || id.length === 0 || id.length > 200) return
          void fetch(`/api/plugins/navigate?resource=${encodeURIComponent(resource)}&id=${encodeURIComponent(id)}`)
            .then((response) => (response.ok ? (response.json() as Promise<{ href: string | null }>) : { href: null }))
            // A full load: it leaves this page's frame policy behind.
            .then((answer) => (answer.href ? window.location.assign(answer.href) : undefined))
            .catch(() => {})
          return
        }
        case "scale.frame.toast": {
          const text = typeof message.payload?.message === "string" ? message.payload.message.slice(0, 300) : ""
          if (!text) return
          const title = `${frame.name}: ${text}`
          if (message.payload?.tone === "success") toast.success(title)
          else if (message.payload?.tone === "error") toast.error(title)
          else toast(title)
          return
        }
        case "scale.frame.resize": {
          const next = clampFrameHeight(message.payload?.height)
          if (next !== null) setHeight(next)
          return
        }
      }
    }

    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [frame, installId])

  const back = (
    // A plain link on purpose: leaving this page must be a full page load, so
    // its frame policy is left behind with the document.
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    <a href="/plugins" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft aria-hidden className="size-4" />
      Plugins
    </a>
  )

  if (state.phase === "error") {
    return (
      <div className="space-y-4">
        {back}
        <EmptyState icon={Puzzle} title="This plugin could not be opened" description={state.message} />
      </div>
    )
  }
  if (!frame) {
    return (
      <div className="space-y-4" aria-label="Opening the plugin">
        {back}
        <Skeleton className="h-[60vh] rounded-lg" />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {back}
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{frame.name}</span> · a plugin from {new URL(frame.pluginOrigin).host}, not part of Lead Finder
        </p>
      </div>
      <iframe
        ref={frameRef}
        src={frame.appUrl}
        title={`${frame.name} (plugin)`}
        sandbox={PLUGIN_FRAME_SANDBOX}
        referrerPolicy="no-referrer"
        className="w-full flex-1 rounded-lg border bg-background"
        style={{ minHeight: FRAME_MIN_HEIGHT, ...(height ? { height, flex: "none" } : {}) }}
      />
    </div>
  )
}

/**
 * Mounted once in the app shell. The frame page's policy belongs to the
 * DOCUMENT, so it would follow a soft navigation to any other screen and block
 * that screen's own embeds. Leaving a document that was loaded as a plugin
 * frame is therefore made a full page load.
 */
export function PluginFramePolicyReset({ pathname }: { pathname: string }) {
  React.useEffect(() => {
    const entry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined
    if (!entry) return
    let loadedPath: string
    try {
      loadedPath = new URL(entry.name).pathname
    } catch {
      return
    }
    if (isPluginFramePath(loadedPath) && loadedPath !== pathname) window.location.reload()
  }, [pathname])
  return null
}
