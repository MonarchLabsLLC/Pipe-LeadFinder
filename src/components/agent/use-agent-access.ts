"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { agentApi, AgentApiError, type AgentAccess } from "./agent-api"

export type AgentAccessState =
  | { status: "loading" }
  | { status: "ready"; access: AgentAccess }
  /** Signed in, Agent enabled, but no active Pro Max plan: show the upsell. */
  | { status: "promax_required" }
  /** Disabled, unavailable or signed out: show nothing Agent-related. */
  | { status: "off" }

// The header button and the page ask at the same time; share one answer for
// a short while. The server re-checks Pro Max on every Agent call anyway, so
// this cache only decides what to draw.
let cached: { at: number; key: string; value: AgentAccessState } | null = null
let inflight: { key: string; promise: Promise<AgentAccessState> } | null = null
const TTL_MS = 30_000

async function loadAccess(key: string): Promise<AgentAccessState> {
  if (cached && cached.key === key && Date.now() - cached.at < TTL_MS) return cached.value
  if (inflight?.key === key) return inflight.promise
  const promise = agentApi<AgentAccess>("access")
    .then((access): AgentAccessState => ({ status: "ready", access }))
    .catch((error): AgentAccessState =>
      error instanceof AgentApiError && error.code === "PROMAX_REQUIRED"
        ? { status: "promax_required" }
        : { status: "off" }
    )
    .then((value) => {
      cached = { at: Date.now(), key, value }
      return value
    })
    .finally(() => {
      inflight = null
    })
  inflight = { key, promise }
  return promise
}

export function useAgentAccess(): AgentAccessState {
  const { data: session, status } = useSession()
  const userId = session?.user?.id
  const [state, setState] = useState<AgentAccessState>({ status: "loading" })
  useEffect(() => {
    if (status === "loading") return
    if (!userId) {
      queueMicrotask(() => setState({ status: "off" }))
      return
    }
    let active = true
    const check = () => {
      void loadAccess(userId).then((value) => {
        if (active) setState(value)
      })
    }
    check()
    const interval = setInterval(check, 60_000)
    window.addEventListener("focus", check)
    return () => {
      active = false
      clearInterval(interval)
      window.removeEventListener("focus", check)
    }
  }, [userId, status])
  return state
}
