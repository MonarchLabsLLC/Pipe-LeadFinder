"use client"

import { useState } from "react"
import { CornerDownLeft, PencilLine } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { AgentQuestion } from "./agent-api"
import { AgentMarkdown } from "./agent-markdown"

/**
 * A clarifying question from the agent (its ask_user tool): tap an answer, or
 * type something else. Only the newest unanswered question is interactive.
 */
export function ChoiceQuestion({
  lead,
  question,
  interactive,
  onAnswer,
}: {
  lead?: string
  question: AgentQuestion
  interactive: boolean
  onAnswer: (answer: string) => void
}) {
  const [other, setOther] = useState(false)
  const [text, setText] = useState("")
  return (
    <div className="min-w-0 space-y-3">
      {lead ? <AgentMarkdown text={lead} /> : null}
      <p className="text-sm font-semibold text-foreground">{question.question}</p>
      <div
        role="group"
        aria-label={question.question}
        className="flex flex-wrap gap-2"
      >
        {question.options.map((option, index) => (
          <button
            key={option}
            type="button"
            disabled={!interactive}
            onClick={() => onAnswer(option)}
            style={{ animationDelay: `${index * 60}ms` }}
            className={cn(
              "inline-flex min-h-10 items-center rounded-full border bg-background px-4 text-sm font-medium text-foreground transition-colors animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both",
              interactive
                ? "cursor-pointer border-primary/30 hover:border-primary hover:bg-primary/5 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                : "cursor-default opacity-60"
            )}
          >
            {option}
          </button>
        ))}
        {question.allowOther && interactive && !other ? (
          <button
            type="button"
            onClick={() => setOther(true)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-dashed px-4 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <PencilLine className="size-3.5" aria-hidden />
            Something else
          </button>
        ) : null}
      </div>
      {other && interactive ? (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (text.trim()) onAnswer(text.trim())
          }}
        >
          <Input
            autoFocus
            value={text}
            maxLength={500}
            onChange={(event) => setText(event.target.value)}
            placeholder="Type your answer"
            aria-label="Your answer"
            className="h-10"
          />
          <Button type="submit" size="sm" className="h-10" disabled={!text.trim()}>
            <CornerDownLeft className="size-4" aria-hidden />
            Answer
          </Button>
        </form>
      ) : null}
    </div>
  )
}
