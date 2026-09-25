"use client"

import Link from "next/link"
import { ArrowRight, Download, Mail, Phone, Send, Sparkles, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ResultSummary } from "./agent-api"

/**
 * Shown under a finished search or enrichment: what landed in the list, a few
 * example leads, "Open list", and one-tap follow-ups that ask the agent for
 * the next step (each one still ends in an approval card).
 */
export function LeadResultsCard({
  summary,
  disabled,
  onFollowUp,
}: {
  summary: ResultSummary
  disabled: boolean
  onFollowUp: (message: string, listId: string) => void
}) {
  const listName = summary.list.name
  const followUps = [
    summary.withoutEmail > 0
      ? {
          icon: Mail,
          label: `Enrich the ${summary.withoutEmail} without email`,
          message: `Find the missing emails for the leads without an email in “${listName}”.`,
        }
      : null,
    { icon: Sparkles, label: "Score them", message: `Score the leads in “${listName}” against my business.` },
    { icon: Send, label: "Send to PipeLeads CRM", message: `Send the leads in “${listName}” to PipeLeads CRM.` },
  ].filter(Boolean) as { icon: typeof Mail; label: string; message: string }[]

  return (
    <section
      aria-label="Search results"
      className="min-w-0 overflow-hidden rounded-2xl border border-success/30 bg-card shadow-sm animate-in fade-in-0 slide-in-from-bottom-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-success/5 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {summary.found !== null ? `${summary.found} new leads found` : "Your list is updated"}
          </p>
          <p className="truncate text-xs text-muted-foreground">Saved to {listName}</p>
        </div>
        <Button asChild size="sm">
          <Link href={summary.list.url}>
            Open list
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </div>
      <div className="space-y-4 p-4">
        <dl className="grid grid-cols-3 gap-2 text-center">
          <Stat icon={Users} label="In list" value={summary.total} />
          <Stat icon={Mail} label="With email" value={summary.withEmail} />
          <Stat icon={Phone} label="With phone" value={summary.withPhone} />
        </dl>
        {summary.sample.length ? (
          <ul className="divide-y rounded-lg border text-sm">
            {summary.sample.map((lead) => (
              <li key={lead.id} className="flex min-w-0 items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{lead.name || lead.company || "Unnamed lead"}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[lead.title, lead.company].filter(Boolean).join(" · ") || "—"}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {lead.email ? "Email ✓" : "No email"}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Next</p>
          <div className="flex flex-wrap gap-2">
            {followUps.map((item) => (
              <Button
                key={item.label}
                size="sm"
                variant="outline"
                className="rounded-full"
                disabled={disabled}
                onClick={() => onFollowUp(item.message, summary.list.id)}
              >
                <item.icon className="size-3.5" aria-hidden />
                {item.label}
              </Button>
            ))}
            <Button asChild size="sm" variant="ghost" className="rounded-full">
              <a href={`/api/lists/${encodeURIComponent(summary.list.id)}/export`}>
                <Download className="size-3.5" aria-hidden />
                Export CSV
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

function Stat({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: number }) {
  return (
    <div className="flex flex-col-reverse rounded-lg border bg-background px-2 py-2.5">
      <dt className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
        <Icon className="size-3" aria-hidden />
        {label}
      </dt>
      <dd className="text-lg font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  )
}
