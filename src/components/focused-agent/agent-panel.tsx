"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { Dialog } from "radix-ui"
import {
  Check,
  Copy,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  X,
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Button } from "@/components/ui/button"
import { CrmHandoff } from "./crm-handoff"

type Access = { userId: string; workspaceId: string; writesEnabled: boolean; handoffEnabled?: boolean }
type Resource = {
  id: string
  name: string
  status: string
  type: string
  url: string
}
type Thread = { id: string; title: string; resourceIds: string[] }
type Message = { id: string; role: string; content: string }
type Approval = {
  id: string
  status: string
  proposalHash: string
  preview: {
    title: string
    before: unknown
    after: unknown
    cost: {
      maximumCredits?: number
      creditsPerUnit?: number
      maximumUnits?: number
      note: string
      model?: string
    }
    skipped?: { id: string; name: string; reason: string }[]
    list: { id: string; name: string; url: string }
    effects: string[]
    url: string
  }
  expiresAt: string
  result?: { url?: string; error?: string }
  job?: {
    stage?: string
    progress?: {percent:number}
    error?: {code:string;message:string}|null
    result?: unknown
  }
}
type State = {
  userId: string
  workspaceId: string
  threads: Thread[]
  thread: Thread | null
  messages: Message[]
  resources: Resource[]
  hasMore: boolean
  runs: { runId: string; threadId: string; status: string; error?: string }[]
  approvals: Approval[]
}

async function api<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch(`/api/focused-agent/${path}`, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    cache: "no-store",
    signal,
    headers:
      body === undefined
        ? {}
        : { "Content-Type": "application/json", "X-Focused-Agent-Action": "1" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const payload = await response.json()
  if (!response.ok)
    throw Object.assign(
      new Error(payload.error?.message || "The Agent request failed."),
      { status: response.status }
    )
  return payload.data
}

export function AgentButton({ className }: { className?: string }) {
  const { data: session, status } = useSession()
  if (status !== "authenticated" || !session?.user?.id) return null
  return <AccessGate key={session.user.id} className={className} />
}
function AccessGate({ className }: { className?: string }) {
  const [access, setAccess] = useState<Access | null>(null)
  useEffect(() => {
    const abort = new AbortController()
    const check = () => {
      void api<Access>("access", undefined, abort.signal)
        .then(setAccess)
        .catch(() => {
          if (!abort.signal.aborted) setAccess(null)
        })
    }
    check()
    const interval = setInterval(check, 60000)
    window.addEventListener("focus", check)
    return () => {
      abort.abort()
      clearInterval(interval)
      window.removeEventListener("focus", check)
    }
  }, [])
  return access ? (
    <div className={className}>
      <AgentPanel
        key={`${access.userId}:${access.workspaceId}`}
        access={access}
      />
    </div>
  ) : null
}

export function AgentPanel({ access }: { access: Access }) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<State | null>(null)
  const [threadId, setThreadId] = useState<string>("")
  const [resourceIds, setResourceIds] = useState<string[]>([])
  const [leadIds, setLeadIds] = useState<string[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [resourceQuery, setResourceQuery] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [shared, setShared] = useState(false)
  const [revision, setRevision] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const generation = useRef(0)
  const invalidate = useCallback(() => ++generation.current, [])
  const restoredThread = useRef("")
  const scroll = useRef<HTMLDivElement>(null)
  const storageKey = `leadfinder-agent:${access.userId}:${access.workspaceId}`
  const refresh = () => setRevision((v) => v + 1)
  const reset = useCallback(() => {
    setState(null)
    setResourceIds([])
    setLeadIds([])
    setResources([])
    setMessage("")
    setShared(false)
    setThreadId("")
    setOpen(false)
  }, [])
  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (!active) return
      try {
        setThreadId(localStorage.getItem(storageKey) || "")
      } catch {}
      if (new URLSearchParams(window.location.search).has("agentApproval"))
        setOpen(true)
    })
    return () => {
      active = false
      invalidate()
      void api("context", { resourceIds: [] }).catch(() => {})
    }
  }, [storageKey, invalidate])
  useEffect(() => {
    if (!open) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [open])
  useEffect(() => {
    if (!open) return
    const abort = new AbortController()
    const current = ++generation.current
    let timer: ReturnType<typeof setTimeout>
    const load = async () => {
      try {
        const next = await api<State>(
          `state${threadId ? `?threadId=${encodeURIComponent(threadId)}` : ""}`,
          undefined,
          abort.signal
        )
        if (current !== generation.current) return
        if (
          next.userId !== access.userId ||
          next.workspaceId !== access.workspaceId
        ) {
          reset()
          return
        }
        setState(next)
        if (!resourceQuery) setResources(next.resources)
        if (
          next.runs.some((r) => ["queued", "running"].includes(r.status)) ||
          next.approvals.some((p) =>
            ["approved", "queued", "running"].includes(p.status)
          )
        )
          timer = setTimeout(load, 2000)
      } catch (e) {
        if (abort.signal.aborted) return
        const status = (e as { status?: number }).status
        if (status === 401 || status === 403) {
          reset()
          return
        }
        if (status === 404 && threadId) {
          setThreadId("")
          try {
            localStorage.removeItem(storageKey)
          } catch {}
        }
        setError((e as Error).message)
      }
    }
    void load()
    return () => {
      abort.abort()
      clearTimeout(timer)
      invalidate()
    }
  }, [
    open,
    threadId,
    revision,
    access.userId,
    access.workspaceId,
    reset,
    storageKey,
    resourceQuery,
    invalidate,
  ])
  useEffect(() => {
    if (!state?.thread) {
      restoredThread.current = ""
      return
    }
    if (state.thread.id === threadId && restoredThread.current !== threadId) {
      setResourceIds(state.thread.resourceIds)
      setLeadIds([])
      restoredThread.current = threadId
    }
  }, [state?.thread, threadId]) // Restore once when switching conversations, not on each poll.
  useEffect(() => {
    if (!open || !resourceQuery) return
    const abort = new AbortController()
    const timer = setTimeout(() => {
      void api<{ resources: Resource[] }>(
        `resources?query=${encodeURIComponent(resourceQuery)}`,
        undefined,
        abort.signal
      )
        .then((r) => setResources(r.resources))
        .catch((e) => {
          if (!abort.signal.aborted) setError(e.message)
        })
    }, 250)
    return () => {
      clearTimeout(timer)
      abort.abort()
    }
  }, [open, resourceQuery])
  useEffect(() => {
    scroll.current?.scrollIntoView({ behavior: "smooth" })
  }, [state?.messages.length])
  useEffect(() => {
    if (!open || !shared) return
    const share = () => {
      void api("context", { resourceIds }).catch((e) => setError(e.message))
    }
    share()
    const timer = setInterval(share, 60000)
    return () => {
      clearInterval(timer)
      void api("context", { resourceIds: [] }).catch(() => {})
    }
  }, [open, shared, resourceIds])
  const remember = (id: string) => {
    setThreadId(id)
    try {
      localStorage.setItem(storageKey, id)
    } catch {}
  }
  const runBusy = state?.runs.some(
    (r) => r.threadId === threadId && ["queued", "running"].includes(r.status)
  )
  async function newConversation() {
    setBusy(true)
    setError("")
    try {
      const { thread } = await api<{ thread: Thread }>("threads", {})
      setState(null)
      setResourceIds([])
      remember(thread.id)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function send() {
    if (!message.trim() || busy || runBusy) return
    setBusy(true)
    setError("")
    try {
      let id = threadId
      if (!id) {
        const result = await api<{ thread: Thread }>("threads", {})
        id = result.thread.id
        remember(id)
      }
      await api("chat", {
        threadId: id,
        message,
        resourceIds,
        leadIds,
        idempotencyKey: crypto.randomUUID(),
      })
      setMessage("")
      refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function decide(p: Approval, decision: "approve" | "reject") {
    setBusy(true)
    setError("")
    try {
      await api(`approvals/${p.id}/decision`, {
        decision,
        proposalHash: p.proposalHash,
      })
      refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (!value) setShared(false)
      }}
    >
      <Dialog.Trigger asChild>
        <Button variant="outline" size="sm">
          <MessageSquare className="hidden size-4 sm:block" />
          Agent
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/35" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex h-dvh w-full min-w-0 flex-col overflow-hidden border-l bg-background shadow-2xl outline-none sm:max-w-[580px]">
          <header className="flex shrink-0 items-center justify-between gap-3 border-b p-4">
            <div>
              <Dialog.Title className="font-semibold">
                Lead Finder Agent
              </Dialog.Title>
              <Dialog.Description className="text-xs text-muted-foreground">
                Private history · Pro Max · AI uses Scale Credits
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close Agent">
                <X className="size-5" />
              </Button>
            </Dialog.Close>
          </header>
          <div className="shrink-0 space-y-3 border-b p-4">
            <div className="flex gap-2">
              <select
                aria-label="Conversation history"
                className="min-w-0 flex-1 rounded-md border bg-background p-2 text-sm"
                value={threadId}
                onChange={(e) => {
                  setState(null)
                  setLeadIds([])
                  remember(e.target.value)
                }}
              >
                <option value="">Choose a conversation</option>
                {state?.threads.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                size="icon"
                onClick={newConversation}
                disabled={busy}
                aria-label="New conversation"
              >
                <Plus className="size-4" />
              </Button>
            </div>
            <details>
              <summary className="cursor-pointer text-sm font-medium">
                Selected list ({resourceIds.length})
              </summary>
              <input
                aria-label="Find a list"
                placeholder="Find a list…"
                className="mt-2 w-full rounded border bg-background p-2 text-sm"
                value={resourceQuery}
                onChange={(e) => setResourceQuery(e.target.value)}
              />
              <div className="mt-2 max-h-36 overflow-y-auto">
                {resources.map((r) => (
                  <label
                    key={r.id}
                    className="flex min-h-11 items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={resourceIds.includes(r.id)}
                      onChange={(e) => {
                        setResourceIds(e.target.checked ? [r.id] : [])
                        setLeadIds([])
                      }}
                    />
                    <span className="break-words">
                      {r.name}{" "}
                      <span className="text-xs text-muted-foreground">
                        ({r.type.toLowerCase()} · {r.status.toLowerCase()})
                      </span>
                    </span>
                  </label>
                ))}
                {!resources.length && (
                  <p className="py-2 text-sm text-muted-foreground">
                    No accessible lists found.
                  </p>
                )}
              </div>
              {state?.hasMore && (
                <p className="text-xs text-muted-foreground">
                  Search to find more lists. Choose one.
                </p>
              )}
            </details>
            <div className="flex flex-wrap gap-1">
              {resourceIds.map((id) => (
                <span
                  className="max-w-full break-words rounded bg-muted px-2 py-1 text-xs"
                  key={id}
                >
                  {resources.find((r) => r.id === id)?.name || "Selected list"}
                </span>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
            {resourceIds[0] && (
              <LeadSelector
                key={resourceIds[0]}
                listId={resourceIds[0]}
                selected={leadIds}
                onChange={setLeadIds}
              />
            )}
            {!state?.messages.length && (
              <p className="text-sm text-muted-foreground">
                Tell me who you want to reach. I’ll ask a few questions, help
                you choose a saved list, and preview the cost before any paid
                search or enrichment. Select saved leads to enrich or score
                them.
              </p>
            )}
            {access.handoffEnabled && resourceIds[0] && <CrmHandoff key={`handoff:${resourceIds[0]}`} listId={resourceIds[0]} leadIds={leadIds} />}
            {state?.messages.map((m) => (
              <article
                key={m.id}
                className={`min-w-0 rounded-xl border p-3 ${m.role === "user" ? "bg-muted/50" : "bg-background"}`}
              >
                <p className="mb-2 text-xs font-semibold text-muted-foreground">
                  {m.role === "user" ? "You" : "Lead Finder Agent"}
                </p>
                <AgentMarkdown text={m.content} />
                <CopyMessage text={m.content} />
              </article>
            ))}
            {state?.approvals.map((p) => (
              <section
                key={p.id}
                className="min-w-0 space-y-3 rounded-xl border border-amber-300 bg-amber-50/30 p-3"
                aria-label="Operation approval"
              >
                <p className="text-sm font-semibold">
                  {p.preview.title} · {p.status}
                </p>
                <p className="text-sm">
                  {p.preview.cost.maximumCredits !== undefined
                    ? `Maximum cost: ${p.preview.cost.maximumCredits} Scale Credits (${p.preview.cost.maximumUnits} × ${p.preview.cost.creditsPerUnit})`
                    : `Metered AI tokens · ${p.preview.cost.model ?? "configured model"}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {p.preview.cost.note}
                </p>
                <details>
                  <summary className="cursor-pointer text-sm font-medium">
                    Exact records and proposed changes
                  </summary>
                  <pre className="mt-2 max-h-80 overflow-y-auto whitespace-pre-wrap break-all rounded bg-muted p-2 font-mono text-xs text-slate-800 dark:text-slate-200">
                    {JSON.stringify(
                      {
                        before: p.preview.before,
                        after: p.preview.after,
                        skipped: p.preview.skipped ?? [],
                      },
                      null,
                      2
                    )}
                  </pre>
                </details>
                {p.job && (
                  <p role="status" className="text-sm">
                    {p.job.stage}{" "}
                    {p.job.progress ? `${p.job.progress.percent}%` : ""}{" "}
                    {p.job.error?.message}
                  </p>
                )}
                {p.result?.error && (
                  <p className="text-sm text-red-700">{p.result.error}</p>
                )}
                {p.job?.result != null && (
                  <pre className="whitespace-pre-wrap break-all text-xs">
                    {JSON.stringify(p.job.result, null, 2)}
                  </pre>
                )}
                {p.preview.effects.map((effect) => (
                  <p key={effect} className="text-xs text-muted-foreground">
                    {effect}
                  </p>
                ))}
                <Link
                  href={p.result?.url || p.preview.list.url}
                  className="inline-block text-sm underline"
                >
                  Open list
                </Link>
                {p.status === "pending" && (
                  <>
                    <p className="text-xs">
                      Preview expires {new Date(p.expiresAt).toLocaleString()}.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => decide(p, "approve")}
                        disabled={
                          busy ||
                          !access.writesEnabled ||
                          Date.parse(p.expiresAt) < now
                        }
                        size="sm"
                      >
                        Approve this operation
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => decide(p, "reject")}
                        disabled={busy}
                        size="sm"
                      >
                        Reject
                      </Button>
                    </div>
                  </>
                )}
              </section>
            ))}
            {state?.runs
              .filter((r) => r.threadId === threadId && r.error)
              .map((r) => (
                <p
                  role="status"
                  className="rounded border border-amber-300 p-3 text-sm"
                  key={r.runId}
                >
                  {r.status === "needs_review" ? "Needs review: " : ""}
                  {r.error}
                </p>
              ))}
            {runBusy && (
              <p
                role="status"
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Loader2 className="size-4 animate-spin" />
                Working… You can close the panel and return.
              </p>
            )}
            {error && (
              <p
                role="alert"
                className="break-words rounded border border-red-300 p-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}
            <div ref={scroll} />
          </div>
          <footer className="shrink-0 space-y-3 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void send()
              }}
              className="flex items-end gap-2"
            >
              <textarea
                aria-label="Message the Agent"
                placeholder="Ask about your selected lists…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={8000}
                rows={2}
                className="min-w-0 flex-1 resize-none rounded-lg border bg-background p-2 text-sm"
              />
              <Button
                type="submit"
                size="icon"
                disabled={busy || runBusy || !message.trim()}
                aria-label="Send message"
              >
                <Send className="size-4" />
              </Button>
            </form>
            <details className="text-xs">
              <summary className="cursor-pointer font-medium">
                Connect to Superpowers
              </summary>
              <p className="mt-2 text-muted-foreground">
                Use the private ScalePlus ProMax Superpowers plugin in Codex or
                Claude with the existing ClickCampaigns OAuth connection.
                External conversations stay in that app.
              </p>
              <a
                className="mt-2 inline-block underline"
                href="https://clickcampaigns.ai/god-mode-guide"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open installation and connection guide
              </a>
              <label className="mt-2 flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  checked={shared}
                  onChange={(e) => setShared(e.target.checked)}
                />
                Share this selection with Superpowers while this panel is open
              </label>
            </details>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function LeadSelector({
  listId,
  selected,
  onChange,
}: {
  listId: string
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [rows, setRows] = useState<
    {
      id: string
      name: string | null
      email: string | null
      company: string | null
    }[]
  >([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const abort = new AbortController()
    void api<{ leads: typeof rows; nextCursor: string | null }>(
      `lists/${encodeURIComponent(listId)}`,
      undefined,
      abort.signal
    )
      .then((r) => {
        setRows(r.leads)
        setCursor(r.nextCursor)
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message)
      })
    return () => abort.abort()
  }, [listId])
  return (
    <details className="rounded border p-3">
      <summary className="cursor-pointer text-sm font-medium">
        Selected saved leads ({selected.length}/50)
      </summary>
      <p className="mt-2 text-xs text-muted-foreground">
        Choose records for enrichment or scoring. Your approved preview always
        identifies the exact records.
      </p>
      <div className="max-h-44 overflow-y-auto">
        {rows.map((r) => (
          <label
            key={r.id}
            className="flex min-h-11 items-center gap-2 text-sm"
          >
            <input
              type="checkbox"
              checked={selected.includes(r.id)}
              disabled={!selected.includes(r.id) && selected.length >= 50}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...selected, r.id]
                    : selected.filter((id) => id !== r.id)
                )
              }
            />
            <span className="min-w-0 break-words">
              {r.name || "Unnamed lead"} ·{" "}
              {r.email || r.company || "Incomplete contact"}
            </span>
          </label>
        ))}
      </div>
      {cursor && (
        <button
          type="button"
          className="min-h-11 text-sm underline"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              const r = await api<{
                leads: typeof rows
                nextCursor: string | null
              }>(
                `lists/${encodeURIComponent(listId)}?cursor=${encodeURIComponent(cursor)}`
              )
              setRows((v) => [...v, ...r.leads])
              setCursor(r.nextCursor)
            } catch (e) {
              setError((e as Error).message)
            } finally {
              setBusy(false)
            }
          }}
        >
          Load more leads
        </button>
      )}
      {!rows.length && !error && (
        <p className="py-2 text-xs">No saved leads in this list yet.</p>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </details>
  )
}

export function AgentMarkdown({ text }: { text: string }) {
  return (
    <div className="min-w-0 break-words text-sm leading-relaxed [&_a]:underline [&_code]:font-mono [&_code]:text-slate-700 [&_li]:ml-5 [&_ol]:list-decimal [&_p]:mb-2 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-slate-100 [&_pre]:p-3 [&_ul]:list-disc">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          table: ({ children }) => (
            <div className="max-w-full overflow-x-auto">
              <table className="w-full border-collapse text-left [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:p-2">
                {children}
              </table>
            </div>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
function CopyMessage({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)
  return (
    <button
      type="button"
      className="mt-2 flex min-h-11 items-center gap-1 text-xs text-muted-foreground"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setFailed(false)
        } catch {
          setFailed(true)
        }
      }}
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {failed
        ? "Copy failed — select the text to copy"
        : copied
          ? "Copied"
          : "Copy message"}
    </button>
  )
}
