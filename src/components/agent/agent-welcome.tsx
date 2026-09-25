"use client"

import { useState } from "react"
import { ArrowUpRight, Building2, MapPin, MessageSquareText, Star, Users, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatRelativeTime } from "@/lib/search-summary"
import type { AgentThread } from "./agent-api"
import { AgentComposer } from "./agent-composer"

type Category = {
  id: string
  label: string
  icon: LucideIcon
  lead: string
  placeholder: string
  prompts: string[]
}

export const AGENT_CATEGORIES: Category[] = [
  {
    id: "people",
    label: "Find people",
    icon: Users,
    lead: "Find people",
    placeholder: "e.g. marketing directors at SaaS companies in Texas",
    prompts: [
      "Heads of sales at fintech startups in New York",
      "HR managers at companies with 200–1,000 employees in Chicago",
      "Owners of marketing agencies in Florida",
    ],
  },
  {
    id: "local",
    label: "Find local businesses",
    icon: MapPin,
    lead: "Find local businesses",
    placeholder: "e.g. dentists in Tampa, FL",
    prompts: ["Dentists in Tampa, FL", "Gyms and fitness studios in Austin, TX", "Roofers near Denver, CO with a website"],
  },
  {
    id: "company",
    label: "Find companies",
    icon: Building2,
    lead: "Find companies",
    placeholder: "e.g. B2B SaaS companies using HubSpot, 11–50 employees",
    prompts: [
      "B2B SaaS companies that use HubSpot, 11–50 employees",
      "Logistics companies in Ohio",
      "Ecommerce brands on Shopify in California",
    ],
  },
  {
    id: "creators",
    label: "Find creators",
    icon: Star,
    lead: "Find creators",
    placeholder: "e.g. fitness creators on Instagram with 10k–100k followers",
    prompts: [
      "Fitness creators on Instagram with 10k–100k followers in the US",
      "Food creators on TikTok in London",
      "Tech reviewers on YouTube",
    ],
  },
]

const DEFAULT_PROMPTS = [
  "Dentists in Tampa, FL — I need emails",
  "Marketing directors at SaaS companies in Texas",
  "Fitness creators on Instagram with 10k–100k followers",
]

/**
 * The Lead Finder front door for Pro Max: one big "Who do you want to find?"
 * box, category chips, suggested prompts and recent conversations.
 */
export function AgentWelcome({
  onSend,
  threads,
  onOpenThread,
  busy,
  error,
}: {
  onSend: (message: string) => Promise<boolean>
  threads: AgentThread[]
  onOpenThread: (id: string) => void
  busy: boolean
  error?: string
}) {
  const [text, setText] = useState("")
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const category = AGENT_CATEGORIES.find((c) => c.id === categoryId) ?? null
  const prompts = category?.prompts ?? DEFAULT_PROMPTS

  async function submit(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return
    const message = category ? `${category.lead}: ${trimmed}` : trimmed
    if (await onSend(message)) setText("")
  }

  return (
    <section
      aria-labelledby="agent-welcome-title"
      className="relative isolate -mx-6 -mt-6 overflow-hidden px-4 pt-14 pb-10 sm:px-6 sm:pt-20"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_60%_at_50%_0%,color-mix(in_oklch,var(--primary)_16%,transparent),transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(60%_55%_at_50%_10%,black,transparent)] bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:22px_22px] opacity-70"
      />
      <div className="mx-auto w-full max-w-3xl">
        <p className="mx-auto mb-4 flex w-fit items-center gap-2 rounded-full border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs backdrop-blur animate-in fade-in-0 slide-in-from-bottom-1">
          <span className="size-1.5 rounded-full bg-success" aria-hidden />
          Lead Finder agent · Pro Max
        </p>
        <h1
          id="agent-welcome-title"
          className="text-center text-3xl font-semibold tracking-tight text-balance text-foreground animate-in fade-in-0 slide-in-from-bottom-2 sm:text-5xl"
        >
          Who do you want to find?
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm text-balance text-muted-foreground animate-in fade-in-0 slide-in-from-bottom-2 sm:text-base">
          Describe them in your own words. I&apos;ll ask a quick question or two, then show you the search
          and its cost. Nothing runs until you approve.
        </p>

        <div className="mt-8 animate-in fade-in-0 slide-in-from-bottom-3 fill-mode-both [animation-delay:80ms]">
          <AgentComposer
            variant="hero"
            value={text}
            onChange={setText}
            onSubmit={() => void submit(text)}
            disabled={busy}
            pending={busy}
            placeholder={category?.placeholder ?? "e.g. dentists in Tampa who have an email address"}
            label="Who do you want to find?"
            footer={category ? <span className="font-medium text-primary">{category.label}</span> : null}
          />
        </div>

        <div
          role="group"
          aria-label="What are you looking for?"
          className="mt-4 flex flex-wrap justify-center gap-2 animate-in fade-in-0 fill-mode-both [animation-delay:140ms]"
        >
          {AGENT_CATEGORIES.map((c) => {
            const on = c.id === categoryId
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => setCategoryId(on ? null : c.id)}
                className={cn(
                  "inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                  on
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "bg-card text-foreground hover:border-primary/40 hover:bg-accent"
                )}
              >
                <c.icon className="size-4" aria-hidden />
                {c.label}
              </button>
            )
          })}
        </div>

        {error ? (
          <p role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-center text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="mt-8 grid gap-2 sm:grid-cols-3">
          {prompts.map((prompt, index) => (
            <button
              key={prompt}
              type="button"
              disabled={busy}
              onClick={() => void submit(prompt)}
              style={{ animationDelay: `${200 + index * 60}ms` }}
              className="group flex min-h-16 items-start justify-between gap-2 rounded-xl border bg-card/80 p-3 text-left text-sm text-foreground shadow-xs backdrop-blur transition-colors animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both hover:border-primary/40 hover:bg-card focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-60"
            >
              <span>{prompt}</span>
              <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" aria-hidden />
            </button>
          ))}
        </div>

        {threads.length ? (
          <div className="mt-8">
            <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Recent conversations
            </h2>
            <ul className="divide-y rounded-xl border bg-card/80 backdrop-blur">
              {threads.slice(0, 4).map((thread) => (
                <li key={thread.id}>
                  <button
                    type="button"
                    onClick={() => onOpenThread(thread.id)}
                    className="flex w-full min-w-0 items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                  >
                    <MessageSquareText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{thread.title}</span>
                    {thread.updatedAt ? (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatRelativeTime(thread.updatedAt)}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  )
}
