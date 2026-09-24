"use client"

import * as React from "react"

import { useSidebar } from "@/components/ui/sidebar"

const SCRIPT_ID = "scaleplus-app-launcher-script"
const SCRIPT_URL =
  process.env.NEXT_PUBLIC_SCALEPLUS_APP_LAUNCHER_URL ||
  "https://app.scaleplus.gg/app-launcher.js"
const ANCHOR_SELECTOR = '[data-scaleplus-launcher-anchor="app-shell"]'

type LauncherInstance = {
  destroy(): void
}

type LauncherApi = {
  mount(options: {
    currentApp: string
    anchor: string
    navigation: "direct"
    target: "_self"
  }): LauncherInstance
}

type LauncherWindow = typeof window & {
  ScalePlusAppLauncher?: LauncherApi
}

/**
 * Loads the shared ScalePlus launcher inside Lead Finder's app shell and
 * mounts its "Apps" pill next to the header anchor. Same loader as PipeLeads
 * Suite's, with Lead Finder marked as the current app.
 */
/**
 * The launcher positions its Apps pill beside the anchor, but only re-measures
 * on window resize. Collapsing or expanding the sidebar moves the anchor
 * without resizing the window, so nudge it through the slide transition.
 */
function useRealignOnSidebarToggle() {
  const { state } = useSidebar()
  const first = React.useRef(true)
  React.useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    let frame = 0
    const started = performance.now()
    const tick = (now: number) => {
      window.dispatchEvent(new Event("resize"))
      if (now - started < 350) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [state])
}

export function ScalePlusAppLauncher() {
  useRealignOnSidebarToggle()
  React.useEffect(() => {
    if (!document.querySelector(ANCHOR_SELECTOR)) return

    const launcherWindow = window as LauncherWindow
    let instance: LauncherInstance | undefined
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
    let createdScript = false
    let cancelled = false

    const mount = () => {
      if (cancelled || instance || !document.querySelector(ANCHOR_SELECTOR)) return

      instance = launcherWindow.ScalePlusAppLauncher?.mount({
        currentApp: "pipeleadsfinder",
        anchor: ANCHOR_SELECTOR,
        navigation: "direct",
        target: "_self",
      })
    }

    if (launcherWindow.ScalePlusAppLauncher) {
      mount()
    } else {
      if (!script) {
        script = document.createElement("script")
        script.id = SCRIPT_ID
        script.src = SCRIPT_URL
        script.async = true
        script.dataset.autoMount = "false"
        document.body.appendChild(script)
        createdScript = true
      }

      script.addEventListener("load", mount, { once: true })
    }

    return () => {
      cancelled = true
      script?.removeEventListener("load", mount)
      instance?.destroy()
      if (createdScript) script?.remove()
    }
  }, [])

  return null
}
