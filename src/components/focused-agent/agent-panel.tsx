"use client"

import { useEffect, useState } from "react"
import { History, MessageSquare, Plus, Settings2, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  agentApi,
  AGENT_OPEN_EVENT,
  type AgentAccess,
  type AgentResource,
} from "@/components/agent/agent-api"
import { AgentAvatar, AgentConversation } from "@/components/agent/agent-conversation"
import { ProposalCard } from "@/components/agent/proposal-card"
import { useAgentAccess } from "@/components/agent/use-agent-access"
import { useAgentThread } from "@/components/agent/use-agent-thread"
import { disclosureSummaryClass, nativeCheckboxClass } from "./styles"
import { CrmHandoff } from "./crm-handoff"
import { LeadSelector } from "./lead-selector"

export { AgentMarkdown } from "@/components/agent/agent-markdown"

const DOCK_CLASS = "lf-agent-dock-open"

/** The header "Agent" button. Hidden unless the Agent is on and the user has Pro Max. */
export function AgentButton({ className }: { className?: string }) {
  const access = useAgentAccess()
  if (access.status !== "ready") return null
  return (
    <div className={className}>
      <AgentDock key={`${access.access.userId}:${access.access.workspaceId}`} access={access.access} />
    </div>
  )
}

/**
 * The same conversation as the new-search page, docked on the right. On wide
 * screens it pushes the page over (like HD Helpdesk) instead of covering it;
 * on phones it is full-screen.
 */
export function AgentDock({ access }: { access: AgentAccess }) {
  const [open, setOpen] = useState(false)
  const [resourceIds, setResourceIds] = useState<string[]>([])
  const [leadIds, setLeadIds] = useState<string[]>([])
  const agent = useAgentThread({ access, active: open, restore: true, resourceIds, leadIds })

  useEffect(() => {
    queueMicrotask(() => {
      if (new URLSearchParams(window.location.search).has("agentApproval")) setOpen(true)
    })
    const onOpen = () => setOpen(true)
    window.addEventListener(AGENT_OPEN_EVENT, onOpen)
    return () => window.removeEventListener(AGENT_OPEN_EVENT, onOpen)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle(DOCK_CLASS, open)
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
      document.documentElement.classList.remove(DOCK_CLASS)
    }
  }, [open])

  // Restore the list a conversation was about when switching to it.
  const threadResources = agent.state?.thread?.id === agent.threadId ? agent.state?.thread?.resourceIds : undefined
  const [restoredFor, setRestoredFor] = useState("")
  if (threadResources && restoredFor !== agent.threadId) {
    setRestoredFor(agent.threadId)
    setResourceIds(threadResources)
    setLeadIds([])
  }

  const otherPending = (agent.state?.approvals ?? []).filter(
    (p) => p.status === "pending" && p.threadId !== agent.state?.thread?.id
  )

  return (
    <>
      <Button
        variant={open ? "secondary" : "outline"}
        size="sm"
        aria-expanded={open}
        aria-controls="lead-finder-agent-dock"
        onClick={() => setOpen((v) => !v)}
      >
        <MessageSquare className="hidden size-4 sm:block" />
        Agent
      </Button>
      <aside
        id="lead-finder-agent-dock"
        aria-label="Lead Finder agent"
        aria-hidden={!open}
        inert={!open}
        data-state={open ? "open" : "closed"}
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l bg-background shadow-2xl transition-transform duration-300 ease-out lg:z-30 lg:w-[var(--lf-agent-dock-width)] lg:shadow-none",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <header className="flex h-16 shrink-0 items-center gap-3 border-b px-4">
          <AgentAvatar />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold">
              {agent.state?.thread?.title ?? "Lead Finder agent"}
            </h2>
            <p className="truncate text-xs text-muted-foreground">Pro Max · AI uses Scale Credits</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Conversation history">
                <History className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>Recent conversations</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(agent.state?.threads ?? []).slice(0, 12).map((t) => (
                <DropdownMenuItem key={t.id} onSelect={() => agent.selectThread(t.id)}>
                  <span className="truncate">{t.title}</span>
                </DropdownMenuItem>
              ))}
              {!agent.state?.threads.length ? (
                <p className="px-2 py-1.5 text-sm text-muted-foreground">No conversations yet.</p>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon" aria-label="New conversation" onClick={agent.newConversation}>
            <Plus className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Close agent" onClick={() => setOpen(false)}>
            <X className="size-4" />
          </Button>
        </header>
        {open ? (
          <>
            <ContextBar
              access={access}
              resourceIds={resourceIds}
              leadIds={leadIds}
              onResources={(ids) => {
                setResourceIds(ids)
                setLeadIds([])
              }}
              onLeads={setLeadIds}
            />
            {otherPending.length ? (
              <details className="shrink-0 border-b px-4 py-2">
                <summary className={disclosureSummaryClass}>
                  {otherPending.length} other approval{otherPending.length === 1 ? "" : "s"} waiting
                </summary>
                <div className="mt-2 max-h-80 space-y-3 overflow-y-auto pb-2">
                  {otherPending.map((p) => (
                    <ProposalCard
                      key={p.id}
                      approval={p}
                      canApprove={access.writesEnabled}
                      busy={agent.busy}
                      onDecide={agent.decide}
                    />
                  ))}
                </div>
              </details>
            ) : null}
            <div className="min-h-0 flex-1">
              <AgentConversation
                agent={agent}
                variant="dock"
                emptyHint={
                  <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    Tell me who you want to reach, like “dentists in Tampa with emails”. I&apos;ll ask what&apos;s
                    missing and show the search and its cost before anything runs. Pick a saved list under
                    Context to enrich, label, score or send its leads.
                  </div>
                }
              />
            </div>
          </>
        ) : null}
      </aside>
    </>
  )
}

/** Kept for the dev fixture (dev/focused-agent-preview.tsx). */
export const AgentPanel = AgentDock

function ContextBar({
  access,
  resourceIds,
  leadIds,
  onResources,
  onLeads,
}: {
  access: AgentAccess
  resourceIds: string[]
  leadIds: string[]
  onResources: (ids: string[]) => void
  onLeads: (ids: string[]) => void
}) {
  const [query, setQuery] = useState("")
  const [resources, setResources] = useState<AgentResource[]>([])
  const [shared, setShared] = useState(false)
  useEffect(() => {
    const abort = new AbortController()
    const timer = setTimeout(() => {
      void agentApi<{ resources: AgentResource[] }>(
        `resources?query=${encodeURIComponent(query)}`,
        undefined,
        abort.signal
      )
        .then((r) => setResources(r.resources))
        .catch(() => {})
    }, 250)
    return () => {
      clearTimeout(timer)
      abort.abort()
    }
  }, [query])
  useEffect(() => {
    if (!shared) return
    const share = () => void agentApi("context", { resourceIds }).catch(() => {})
    share()
    const timer = setInterval(share, 60_000)
    return () => {
      clearInterval(timer)
      void agentApi("context", { resourceIds: [] }).catch(() => {})
    }
  }, [shared, resourceIds])
  const selected = resources.find((r) => r.id === resourceIds[0])
  return (
    <details className="shrink-0 border-b px-4 py-2">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium marker:text-muted-foreground">
        <Settings2 className="size-4 text-muted-foreground" aria-hidden />
        Context
        {resourceIds.length ? (
          <Badge variant="secondary" className="max-w-[60%] truncate">
            {selected?.name ?? "Selected list"}
            {leadIds.length ? ` · ${leadIds.length} leads` : ""}
          </Badge>
        ) : (
          <span className="text-xs font-normal text-muted-foreground">All my lists</span>
        )}
      </summary>
      <div className="mt-2 max-h-[45vh] space-y-3 overflow-y-auto pb-2">
        <Input
          aria-label="Find a list"
          placeholder="Find a list…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="max-h-36 overflow-y-auto">
          {resources.map((r) => (
            <label
              key={r.id}
              className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-2 text-sm hover:bg-muted/50"
            >
              <input
                type="checkbox"
                className={nativeCheckboxClass}
                checked={resourceIds.includes(r.id)}
                onChange={(e) => onResources(e.target.checked ? [r.id] : [])}
              />
              <span className="break-words">
                {r.name}{" "}
                <span className="text-xs text-muted-foreground">
                  ({r.type.toLowerCase()} · {r.status.toLowerCase()})
                </span>
              </span>
            </label>
          ))}
          {!resources.length ? <p className="py-2 text-sm text-muted-foreground">No lists found.</p> : null}
        </div>
        {resourceIds[0] ? (
          <LeadSelector key={resourceIds[0]} listId={resourceIds[0]} selected={leadIds} onChange={onLeads} />
        ) : null}
        {access.handoffEnabled && resourceIds[0] ? (
          <CrmHandoff key={`handoff:${resourceIds[0]}`} listId={resourceIds[0]} leadIds={leadIds} />
        ) : null}
        <details className="text-xs">
          <summary className="cursor-pointer font-medium text-foreground marker:text-muted-foreground">
            Connect to Superpowers
          </summary>
          <p className="mt-2 text-muted-foreground">
            Use the private ScalePlus ProMax Superpowers plugin in Codex or Claude with the existing
            ClickCampaigns OAuth connection. External conversations stay in that app.
          </p>
          <a
            className="mt-2 inline-block font-medium text-primary underline-offset-4 hover:underline"
            href="https://clickcampaigns.ai/god-mode-guide"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open installation and connection guide
          </a>
          <label className="mt-2 flex min-h-10 cursor-pointer items-center gap-2 text-muted-foreground">
            <input
              type="checkbox"
              className={nativeCheckboxClass}
              checked={shared}
              onChange={(e) => setShared(e.target.checked)}
            />
            Share this selection with Superpowers while this panel is open
          </label>
        </details>
      </div>
    </details>
  )
}
