"use client"

import { MessageSquarePlus, PanelRightOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DescribeSearch, type SearchSuggestion } from "@/components/search/describe-search"
import { openAgentDock, type AgentAccess, type AgentApproval } from "./agent-api"
import { AgentConversation } from "./agent-conversation"
import { AgentUpsellCard } from "./agent-upsell-card"
import { AgentWelcome } from "./agent-welcome"
import { useAgentAccess } from "./use-agent-access"
import { useAgentThread } from "./use-agent-thread"

/**
 * The top of New search. Pro Max: the agent welcome, then the conversation
 * full-width once you send. Everyone else: "Describe who you want", plus a
 * small Pro Max invitation when the agent is switched on.
 */
export function AgentFrontDoor({
  onSuggested,
  onEditSearch,
  header,
}: {
  onSuggested: (suggestion: SearchSuggestion) => void
  /** Open the manual search form pre-filled from a proposal. */
  onEditSearch: (type: SearchSuggestion["searchType"], values: Record<string, unknown>) => void
  /** The classic page heading, shown when the agent is not the front door. */
  header: React.ReactNode
}) {
  const access = useAgentAccess()
  if (access.status === "loading")
    return (
      <div className="space-y-4 py-10" aria-busy="true" aria-label="Loading">
        <Skeleton className="mx-auto h-10 w-2/3 max-w-md" />
        <Skeleton className="mx-auto h-28 w-full max-w-3xl rounded-3xl" />
      </div>
    )
  if (access.status === "ready")
    return <ProMaxFrontDoor access={access.access} onEditSearch={onEditSearch} />
  return (
    <>
      {header}
      <DescribeSearch onSuggested={onSuggested} />
      {access.status === "promax_required" ? <AgentUpsellCard /> : null}
    </>
  )
}

function ProMaxFrontDoor({
  access,
  onEditSearch,
}: {
  access: AgentAccess
  onEditSearch: (type: SearchSuggestion["searchType"], values: Record<string, unknown>) => void
}) {
  const agent = useAgentThread({ access, active: true, restore: false })
  const inConversation = Boolean(agent.threadId)

  function edit(approval: AgentApproval) {
    const before = approval.preview.before as { parameters?: Record<string, unknown> } | undefined
    if (approval.preview.kind === "search" && approval.preview.searchType && before?.parameters) {
      const { duplicatePolicy: _policy, ...values } = before.parameters
      void _policy
      onEditSearch(approval.preview.searchType as SearchSuggestion["searchType"], values)
      return
    }
    void agent.send("I'd like to change that.")
  }

  if (!inConversation)
    return (
      <AgentWelcome
        busy={agent.busy}
        error={agent.error}
        threads={agent.state?.threads ?? []}
        onOpenThread={agent.selectThread}
        onSend={(message) => agent.send(message, { newThread: true })}
      />
    )

  return (
    <section aria-label="Conversation with the Lead Finder agent" className="mx-auto w-full max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">Lead Finder agent</p>
          <h1 className="truncate text-lg font-semibold">{agent.state?.thread?.title ?? "New conversation"}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={openAgentDock} className="hidden lg:inline-flex">
            <PanelRightOpen className="size-4" aria-hidden />
            Open in panel
          </Button>
          <Button variant="outline" size="sm" onClick={agent.newConversation}>
            <MessageSquarePlus className="size-4" aria-hidden />
            New search chat
          </Button>
        </div>
      </div>
      <AgentConversation agent={agent} onEdit={edit} variant="page" />
    </section>
  )
}
