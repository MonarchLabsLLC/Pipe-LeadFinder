"use client"

import Script from "next/script"
import { useCallback, useEffect, useRef } from "react"

const SCRIPT_ID = "scaleplus-app-launcher-script"
const SCRIPT_URL =
  process.env.NEXT_PUBLIC_SCALEPLUS_APP_LAUNCHER_URL ||
  "https://app.scaleplus.gg/app-launcher.js"
const ANCHOR_SELECTOR = "[data-scaleplus-launcher-anchor]"

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

/** Loads the shared launcher only inside PipeLeads LeadFinder's app shell. */
export function ScalePlusAppLauncher() {
  const instanceRef = useRef<LauncherInstance | undefined>(undefined)

  const mount = useCallback(() => {
    if (!document.querySelector(ANCHOR_SELECTOR)) return

    instanceRef.current?.destroy()
    const launcherWindow = window as LauncherWindow
    instanceRef.current = launcherWindow.ScalePlusAppLauncher?.mount({
      currentApp: "pipeleadsfinder",
      anchor: ANCHOR_SELECTOR,
      navigation: "direct",
      target: "_self",
    })
  }, [])

  useEffect(() => {
    return () => {
      instanceRef.current?.destroy()
      instanceRef.current = undefined
    }
  }, [])

  return (
    <Script
      id={SCRIPT_ID}
      src={SCRIPT_URL}
      strategy="afterInteractive"
      data-auto-mount="false"
      onReady={mount}
    />
  )
}
