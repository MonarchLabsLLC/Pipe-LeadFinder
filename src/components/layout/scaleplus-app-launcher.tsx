"use client"

import Script from "next/script"
import { useCallback, useEffect, useRef, useState } from "react"
import { getToken, updateToken } from "@/lib/keycloak-client"

const SCRIPT_ID = "scaleplus-app-launcher-script"
const SCRIPT_URL =
  process.env.NEXT_PUBLIC_SCALEPLUS_APP_LAUNCHER_URL ||
  "https://app.scaleplus.gg/app-launcher-v1.5.1.js"
const ANCHOR_SELECTOR = "[data-scaleplus-launcher-anchor]"

type LauncherInstance = {
  destroy(): void
}

type WorkspaceContext = {
  activeWorkspaceId: string
  manageUrl: string
  workspaces: Array<{ id: string; name: string; type: "personal" | "guest"; role: "owner" | "member"; ownerName?: string; switchUrl: string }>
}

type LauncherApi = {
  mount(options: {
    currentApp: string
    anchor: string
    navigation: "direct"
    target: "_self"
    workspaceContext?: WorkspaceContext
  }): LauncherInstance
}

type LauncherWindow = typeof window & {
  ScalePlusAppLauncher?: LauncherApi
}

/** Loads the shared launcher only inside PipeLeads LeadFinder's app shell. */
export function ScalePlusAppLauncher() {
  const instanceRef = useRef<LauncherInstance | undefined>(undefined)
  const [workspaceContext, setWorkspaceContext] = useState<WorkspaceContext>()
  const [selectorReady, setSelectorReady] = useState(false)

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        await updateToken(30)
        const token = getToken()
        const returnPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
        const response = await fetch(`/api/scale-workspace/selector-context?returnPath=${encodeURIComponent(returnPath)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
        const payload = response.ok ? await response.json() : null
        if (active && payload?.workspaceContext) setWorkspaceContext(payload.workspaceContext as WorkspaceContext)
      } catch {
        // The shared launcher still mounts without selector data.
      } finally {
        if (active) setSelectorReady(true)
      }
    })()
    return () => { active = false }
  }, [])

  const mount = useCallback(() => {
    if (!selectorReady || !document.querySelector(ANCHOR_SELECTOR)) return

    instanceRef.current?.destroy()
    const launcherWindow = window as LauncherWindow
    instanceRef.current = launcherWindow.ScalePlusAppLauncher?.mount({
      currentApp: "pipeleadsfinder",
      anchor: ANCHOR_SELECTOR,
      navigation: "direct",
      target: "_self",
      workspaceContext,
    })
  }, [selectorReady, workspaceContext])

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
