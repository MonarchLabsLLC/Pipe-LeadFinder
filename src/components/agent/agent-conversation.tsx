"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Copy, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AgentApproval, AgentMessage } from "./agent-api"
import { AgentComposer } from "./agent-composer"
import { AgentMarkdown } from "./agent-markdown"
import { ChoiceQuestion } from "./choice-question"
import { LeadResultsCard } from "./lead-results-card"
import { ProposalCard } from "./proposal-card"
import type { AgentThreadController } from "./use-agent-thread"

/**
 * The conversation: your messages, the agent's answers and questions,
 * approval cards and result cards in time order, then the message box.
 * Used full-width on the new-search page and inside the docked panel.
 */
export function AgentConversation({
  agent,
  onEdit,
  variant = "page",
  emptyHint,
}: {
  agent: AgentThreadController
  onEdit?: (approval: AgentApproval) => void
  variant?: "page" | "dock"
  emptyHint?: React.ReactNode
}) {
  const [draft, setDraft] = useState("")
  const end = useRef<HTMLDivElement>(null)
  const { timeline, runBusy, busy } = agent
  const lastKey = timeline.length
    ? `${timeline.length}:${timeline[timeline.length - 1].type}:${runBusy}`
    : ""
  useEffect(() => {
    if (lastKey) end.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [lastKey])

  const last = timeline[timeline.length - 1]
  const openQuestionId =
    last?.type === "message" && last.message.metadata?.kind === "question" && !runBusy
      ? last.message.id
      : null
  const answer = (text: string, resourceIds?: string[]) =>
    void agent.send(text, resourceIds ? { resourceIds } : {})

  const page = variant === "page"
  return (
    <div className={cn("flex min-h-0 flex-col", page ? "gap-6" : "h-full")}>
      <div
        className={cn(
          "min-w-0 space-y-5",
          !page && "min-h-0 flex-1 overflow-y-auto overscroll-contain p-4"
        )}
        aria-live="polite"
      >
        {!timeline.length && emptyHint}
        {timeline.map((item) =>
          item.type === "message" ? (
            <MessageBubble
              key={item.message.id}
              message={item.message}
              interactive={item.message.id === openQuestionId && !busy}
              onAnswer={(text) => answer(text)}
            />
          ) : (
            <div key={item.approval.id} className="space-y-3">
              <ProposalCard
                approval={item.approval}
                canApprove={agent.access.writesEnabled}
                busy={busy}
                onDecide={agent.decide}
                onEdit={
                  onEdit ??
                  (() => setDraft("Change it: "))
                }
              />
              {item.approval.summary ? (
                <LeadResultsCard
                  summary={item.approval.summary}
                  disabled={busy || runBusy}
                  onFollowUp={(message, listId) => answer(message, [listId])}
                />
              ) : null}
            </div>
          )
        )}
        {runBusy ? <Thinking /> : null}
        {agent.runErrors.map((run) => (
          <p
            key={run.runId}
            role="status"
            className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-foreground"
          >
            {run.status === "needs_review" ? "Needs review: " : ""}
            {run.error}
          </p>
        ))}
        {agent.error ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm break-words text-destructive"
          >
            {agent.error}
          </p>
        ) : null}
        <div ref={end} />
      </div>
      <div
        className={cn(
          page
            ? "sticky bottom-0 -mx-1 bg-gradient-to-t from-background via-background to-background/0 px-1 pt-4 pb-1"
            : "shrink-0 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        )}
      >
        <AgentComposer
          value={draft}
          onChange={setDraft}
          onSubmit={async () => {
            const text = draft
            setDraft("")
            if (!(await agent.send(text))) setDraft(text)
          }}
          disabled={busy || runBusy}
          pending={busy}
          placeholder={
            openQuestionId ? "Tap an answer above, or type your own…" : "Ask a follow-up, like “enrich the ones without email”"
          }
          footer="Nothing paid runs until you approve it."
        />
      </div>
    </div>
  )
}

function MessageBubble({
  message,
  interactive,
  onAnswer,
}: {
  message: AgentMessage
  interactive: boolean
  onAnswer: (text: string) => void
}) {
  if (message.role === "user")
    return (
      <div className="flex justify-end animate-in fade-in-0 slide-in-from-bottom-1">
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm break-words whitespace-pre-wrap text-primary-foreground shadow-sm">
          {message.content}
        </p>
      </div>
    )
  const question = message.metadata?.kind === "question" ? message.metadata.question : undefined
  return (
    <div className="flex gap-3 animate-in fade-in-0 slide-in-from-bottom-1">
      <AgentAvatar />
      <div className="min-w-0 flex-1 pt-0.5">
        {question ? (
          <ChoiceQuestion
            lead={message.metadata?.lead}
            question={question}
            interactive={interactive}
            onAnswer={onAnswer}
          />
        ) : (
          <>
            <AgentMarkdown text={message.content} />
            <CopyMessage text={message.content} />
          </>
        )}
      </div>
    </div>
  )
}

export function AgentAvatar({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-chart-3 text-primary-foreground shadow-sm",
        className
      )}
    >
      <Sparkles className="size-4" />
    </span>
  )
}

function Thinking() {
  return (
    <div role="status" className="flex items-center gap-3">
      <AgentAvatar />
      <span className="flex items-center gap-1 rounded-full bg-muted px-3 py-2" aria-label="The agent is working">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </span>
      <span className="text-xs text-muted-foreground">Working… you can leave this page and come back.</span>
    </div>
  )
}

function CopyMessage({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="mt-1 inline-flex min-h-8 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {}
      }}
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  )
}
