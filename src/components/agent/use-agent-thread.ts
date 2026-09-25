"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  agentApi,
  AGENT_REFRESH_EVENT,
  AGENT_THREAD_EVENT,
  threadStorageKey,
  type AgentAccess,
  type AgentApproval,
  type AgentMessage,
  type AgentState,
  type AgentThread,
} from "./agent-api"

export type TimelineItem =
  | { type: "message"; at: number; message: AgentMessage }
  | { type: "approval"; at: number; approval: AgentApproval }

const ACTIVE_RUN = ["queued", "running"]
const ACTIVE_JOB = ["approved", "queued", "running"]

/**
 * One Agent conversation: loads it, polls while an answer or an approved job
 * is in progress, and sends messages and approval decisions. The docked
 * panel and the new-search page each use one; they stay on the same thread
 * through a window event and localStorage.
 */
export function useAgentThread({
  access,
  active,
  restore = true,
  resourceIds = [],
  leadIds = [],
}: {
  access: AgentAccess
  /** Only load and poll while the surface is visible. */
  active: boolean
  /** Reopen the last thread (the panel) or start on the welcome (the page). */
  restore?: boolean
  resourceIds?: string[]
  leadIds?: string[]
}) {
  const storageKey = threadStorageKey(access)
  const [threadId, setThreadId] = useState("")
  const [state, setState] = useState<AgentState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [revision, setRevision] = useState(0)
  const generation = useRef(0)
  const refresh = useCallback(() => setRevision((v) => v + 1), [])

  useEffect(() => {
    if (!restore) return
    queueMicrotask(() => {
      try {
        setThreadId(localStorage.getItem(storageKey) || "")
      } catch {}
    })
  }, [restore, storageKey])

  // Follow the other surface when it switches threads or sends a message.
  useEffect(() => {
    const onThread = (event: Event) => {
      const id = (event as CustomEvent<{ id: string; key: string }>).detail
      if (id?.key === storageKey) setThreadId(id.id)
    }
    const onRefresh = () => setRevision((v) => v + 1)
    window.addEventListener(AGENT_THREAD_EVENT, onThread)
    window.addEventListener(AGENT_REFRESH_EVENT, onRefresh)
    return () => {
      window.removeEventListener(AGENT_THREAD_EVENT, onThread)
      window.removeEventListener(AGENT_REFRESH_EVENT, onRefresh)
    }
  }, [storageKey])

  const selectThread = useCallback(
    (id: string) => {
      setState((current) => (current && current.thread?.id !== id ? { ...current, thread: null, messages: [] } : current))
      setThreadId(id)
      try {
        if (id) localStorage.setItem(storageKey, id)
      } catch {}
      window.dispatchEvent(new CustomEvent(AGENT_THREAD_EVENT, { detail: { id, key: storageKey } }))
    },
    [storageKey]
  )

  useEffect(() => {
    if (!active) return
    const abort = new AbortController()
    const current = ++generation.current
    let timer: ReturnType<typeof setTimeout>
    const load = async () => {
      try {
        // Without a thread the page shows the welcome; still load the list
        // of recent conversations, but not the last thread's messages.
        const next = await agentApi<AgentState>(
          `state${threadId ? `?threadId=${encodeURIComponent(threadId)}` : ""}`,
          undefined,
          abort.signal
        )
        if (current !== generation.current) return
        if (next.userId !== access.userId || next.workspaceId !== access.workspaceId) return
        setState(threadId ? next : { ...next, thread: null, messages: [], runs: [] })
        const polling =
          (threadId && next.runs.some((r) => ACTIVE_RUN.includes(r.status))) ||
          next.approvals.some((p) => ACTIVE_JOB.includes(p.status))
        if (polling) timer = setTimeout(load, 2000)
      } catch (e) {
        if (abort.signal.aborted) return
        const status = (e as { status?: number }).status
        if (status === 404 && threadId) {
          selectThread("")
          try {
            localStorage.removeItem(storageKey)
          } catch {}
          return
        }
        setError((e as Error).message)
      }
    }
    void load()
    return () => {
      abort.abort()
      clearTimeout(timer)
    }
  }, [active, threadId, revision, access.userId, access.workspaceId, storageKey, selectThread])

  const runBusy = Boolean(
    threadId && state?.runs.some((r) => r.threadId === threadId && ACTIVE_RUN.includes(r.status))
  )

  const send = useCallback(
    async (text: string, options: { resourceIds?: string[]; newThread?: boolean } = {}) => {
      const message = text.trim()
      if (!message || busy || runBusy) return false
      setBusy(true)
      setError("")
      try {
        let id = options.newThread ? "" : threadId
        if (!id) {
          const created = await agentApi<{ thread: AgentThread }>("threads", {})
          id = created.thread.id
          selectThread(id)
        }
        await agentApi("chat", {
          threadId: id,
          message: message.slice(0, 8000),
          resourceIds: options.resourceIds ?? resourceIds,
          leadIds: options.resourceIds ? [] : leadIds,
          idempotencyKey: crypto.randomUUID(),
        })
        refresh()
        window.dispatchEvent(new CustomEvent(AGENT_REFRESH_EVENT))
        return true
      } catch (e) {
        setError((e as Error).message)
        return false
      } finally {
        setBusy(false)
      }
    },
    [busy, runBusy, threadId, resourceIds, leadIds, selectThread, refresh]
  )

  const decide = useCallback(
    async (p: AgentApproval, decision: "approve" | "reject") => {
      setBusy(true)
      setError("")
      try {
        await agentApi(`approvals/${p.id}/decision`, { decision, proposalHash: p.proposalHash })
        refresh()
        window.dispatchEvent(new CustomEvent(AGENT_REFRESH_EVENT))
      } catch (e) {
        setError((e as Error).message)
        refresh()
      } finally {
        setBusy(false)
      }
    },
    [refresh]
  )

  const newConversation = useCallback(() => {
    setState((current) => (current ? { ...current, thread: null, messages: [], runs: [] } : current))
    selectThread("")
  }, [selectThread])

  const timeline = useMemo<TimelineItem[]>(() => {
    if (!state?.thread) return []
    const items: TimelineItem[] = [
      ...state.messages.map((message) => ({
        type: "message" as const,
        at: Date.parse(message.createdAt),
        message,
      })),
      ...state.approvals
        .filter((approval) => approval.threadId === state.thread!.id)
        .map((approval) => ({
          type: "approval" as const,
          at: Date.parse(approval.createdAt ?? "") || 0,
          approval,
        })),
    ]
    return items.sort((a, b) => a.at - b.at)
  }, [state])

  const runErrors = (state?.runs ?? []).filter((r) => r.threadId === threadId && r.error)

  return {
    access,
    state,
    threadId,
    timeline,
    runErrors,
    runBusy,
    busy,
    error,
    clearError: () => setError(""),
    selectThread,
    newConversation,
    send,
    decide,
    refresh,
  }
}

export type AgentThreadController = ReturnType<typeof useAgentThread>
