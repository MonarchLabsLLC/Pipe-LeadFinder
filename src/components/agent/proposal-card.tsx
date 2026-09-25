"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Bot,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Coins,
  ListPlus,
  Loader2,
  Mail,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Tag,
  TriangleAlert,
  XCircle,
  type LucideIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatDisplayCredits } from "@/lib/pipeleads-credit-pricing"
import { SEARCH_GUIDE_BY_TYPE } from "@/components/search/search-guide"
import type { SearchType } from "@/generated/prisma/enums"
import type { AgentApproval, LeadPreview } from "./agent-api"

const KIND: Record<string, { icon: LucideIcon; label: string }> = {
  search: { icon: Search, label: "Search" },
  enrich: { icon: Mail, label: "Enrichment" },
  score: { icon: Sparkles, label: "Scoring" },
  label: { icon: Tag, label: "Label" },
  handoff: { icon: Send, label: "Handoff" },
  agent: { icon: CalendarClock, label: "Scheduled agent" },
}

const STATUS: Record<string, { label: string; tone: "pending" | "working" | "done" | "stopped" }> = {
  pending: { label: "Waiting for your approval", tone: "pending" },
  approved: { label: "Approved · starting", tone: "working" },
  queued: { label: "Queued", tone: "working" },
  running: { label: "Running", tone: "working" },
  completed: { label: "Done", tone: "done" },
  rejected: { label: "Rejected", tone: "stopped" },
  failed: { label: "Failed", tone: "stopped" },
  cancelled: { label: "Cancelled", tone: "stopped" },
  needs_review: { label: "Needs review", tone: "stopped" },
}

const HIDDEN_CRITERIA = new Set(["listId", "duplicatePolicy"])

function humanKey(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase())
    .replace("Results Limit", "Results")
}

function criteriaOf(approval: AgentApproval): [string, string][] {
  const before = approval.preview.before as { parameters?: Record<string, unknown> } | undefined
  const params = before?.parameters
  if (!params || typeof params !== "object") return []
  return Object.entries(params)
    .filter(([key, value]) => !HIDDEN_CRITERIA.has(key) && value !== undefined && value !== null && value !== "")
    .map(([key, value]) => [humanKey(key), Array.isArray(value) ? value.join(", ") : String(value)])
}

function leadsOf(approval: AgentApproval): LeadPreview[] {
  return Array.isArray(approval.preview.before) ? (approval.preview.before as LeadPreview[]) : []
}

export function ProposalCard({
  approval,
  canApprove,
  busy,
  onDecide,
  onEdit,
}: {
  approval: AgentApproval
  canApprove: boolean
  busy: boolean
  onDecide: (approval: AgentApproval, decision: "approve" | "reject") => void
  onEdit?: (approval: AgentApproval) => void
}) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(timer)
  }, [])
  const p = approval.preview
  const kind = KIND[p.kind ?? approval.action ?? "search"] ?? KIND.search
  const status = STATUS[approval.status] ?? { label: approval.status, tone: "working" as const }
  const expired = approval.status === "pending" && Date.parse(approval.expiresAt) < now
  const pending = approval.status === "pending" && !expired
  const Icon = kind.icon
  const criteria = criteriaOf(approval)
  const leads = leadsOf(approval)
  const guide = p.searchType ? SEARCH_GUIDE_BY_TYPE[p.searchType as SearchType] : null
  const credits = p.cost.maximumCredits
  const percent = approval.job?.progress?.percent ?? 0
  const listHref = approval.result?.url || p.list.url

  return (
    <section
      aria-label={`${kind.label} proposal`}
      className={cn(
        "min-w-0 overflow-hidden rounded-2xl border bg-card shadow-sm animate-in fade-in-0 slide-in-from-bottom-2",
        pending && "border-primary/40 ring-4 ring-primary/5"
      )}
    >
      <header
        className={cn(
          "flex items-center justify-between gap-3 border-b px-4 py-2.5",
          pending ? "bg-primary/5" : "bg-muted/40"
        )}
      >
        <span className="flex min-w-0 items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <ShieldCheck className={cn("size-4 shrink-0", pending && "text-primary")} aria-hidden />
          <span className="truncate">{kind.label}{pending ? " · needs approval" : ""}</span>
        </span>
        <StatusPill tone={expired ? "stopped" : status.tone} label={expired ? "Expired" : status.label} />
      </header>

      <div className="space-y-4 p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {guide ? <guide.icon className="size-4" aria-hidden /> : <Icon className="size-4" aria-hidden />}
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold break-words text-foreground">{p.title}</h3>
            {guide ? <p className="text-xs text-muted-foreground">{guide.name}</p> : null}
          </div>
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {criteria.length ? (
            <div className="min-w-0 sm:col-span-2">
              <dt className="mb-1.5 text-xs font-medium text-muted-foreground">Criteria</dt>
              <dd className="flex flex-wrap gap-1.5">
                {criteria.map(([key, value]) => (
                  <span
                    key={key}
                    className="inline-flex max-w-full items-baseline gap-1 rounded-md border bg-background px-2 py-1 text-xs"
                  >
                    <span className="text-muted-foreground">{key}</span>
                    <span className="font-medium break-words text-foreground">{value}</span>
                  </span>
                ))}
              </dd>
            </div>
          ) : null}
          <Fact icon={ListPlus} label="Target list">
            <span className="break-words">{p.list.name}</span>
            {p.list.isNew ? (
              <Badge variant="secondary" className="ml-1.5 align-middle">
                New
              </Badge>
            ) : null}
          </Fact>
          <Fact icon={Coins} label="Estimated credits">
            {credits !== undefined ? (
              credits === 0 ? (
                "Free"
              ) : (
                <>
                  Up to {formatDisplayCredits(credits)}
                  {p.cost.maximumUnits ? (
                    <span className="text-muted-foreground">
                      {" "}
                      ({p.cost.maximumUnits} × {formatDisplayCredits(p.cost.creditsPerUnit ?? 0)})
                    </span>
                  ) : null}
                </>
              )
            ) : (
              "Metered AI tokens"
            )}
          </Fact>
          {p.destination ? (
            <Fact icon={Send} label="Destination">
              {p.target === "mailbaser"
                ? [p.destination.workspaceName ?? "MailBaser", ...(p.destination.lists ?? []).map((l) => l.name)].join(" · ")
                : p.destination.createDeals && p.destination.pipeline
                  ? `PipeLeads CRM · ${p.destination.pipeline.name} → ${p.destination.stage?.name ?? ""}`
                  : "PipeLeads CRM contacts"}
            </Fact>
          ) : null}
          {p.schedule ? (
            <Fact icon={CalendarClock} label="Schedule">
              Runs {p.schedule}
            </Fact>
          ) : null}
          {p.label ? (
            <Fact icon={Tag} label="Label">
              {p.label.name}
            </Fact>
          ) : null}
        </dl>

        {p.cost.note ? <p className="text-xs text-muted-foreground">{p.cost.note}</p> : null}

        {leads.length ? (
          <details className="group rounded-lg border bg-background/60">
            <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-foreground marker:text-muted-foreground">
              {p.eligibleCount ?? leads.length} leads
              {p.skipped?.length ? ` · ${p.skipped.length} skipped` : ""}
            </summary>
            <ul className="max-h-48 divide-y overflow-y-auto border-t text-xs">
              {leads.map((lead) => (
                <li key={lead.id} className="flex min-w-0 justify-between gap-3 px-3 py-1.5">
                  <span className="truncate font-medium">{lead.name || "Unnamed lead"}</span>
                  <span className="truncate text-muted-foreground">{lead.email || lead.company || "—"}</span>
                </li>
              ))}
              {p.skipped?.map((s) => (
                <li key={`skip-${s.id}`} className="flex justify-between gap-3 px-3 py-1.5 text-muted-foreground">
                  <span className="truncate">{s.name || "Unnamed lead"}</span>
                  <span className="shrink-0">{s.reason}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        <ul className="space-y-1">
          {p.effects.map((effect) => (
            <li key={effect} className="flex gap-2 text-xs text-muted-foreground">
              <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/60" />
              {effect}
            </li>
          ))}
        </ul>

        {status.tone === "working" && !expired ? (
          <div role="status" className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                {approval.job?.stage || status.label}
              </span>
              {approval.job?.progress ? <span className="tabular-nums">{percent}%</span> : null}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${Math.max(6, percent)}%` }}
              />
            </div>
          </div>
        ) : null}

        {approval.job?.error?.message || approval.result?.error ? (
          <p role="alert" className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
            <TriangleAlert className="size-4 shrink-0" aria-hidden />
            {approval.job?.error?.message || approval.result?.error}
          </p>
        ) : null}

        {approval.status === "completed" && approval.result?.counts ? (
          <p className="text-sm">
            Sent: {approval.result.counts.created ?? 0} new, {approval.result.counts.updated ?? 0} updated,{" "}
            {approval.result.counts.skipped ?? 0} skipped.
            {approval.result.openUrl ? (
              <a
                href={approval.result.openUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 font-medium text-primary underline-offset-4 hover:underline"
              >
                Open
              </a>
            ) : null}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {pending ? (
            <>
              <Button size="sm" onClick={() => onDecide(approval, "approve")} disabled={busy || !canApprove}>
                <CheckCircle2 className="size-4" aria-hidden />
                Approve &amp; run
              </Button>
              {onEdit ? (
                <Button size="sm" variant="outline" onClick={() => onEdit(approval)} disabled={busy}>
                  Edit
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" onClick={() => onDecide(approval, "reject")} disabled={busy}>
                Reject
              </Button>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock3 className="size-3.5" aria-hidden />
                Expires {new Date(approval.expiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </span>
            </>
          ) : null}
          {!canApprove && pending ? (
            <p className="w-full text-xs text-muted-foreground">
              Paid Agent actions are switched off here. Nothing will run.
            </p>
          ) : null}
          {listHref && !pending ? (
            <Button asChild size="sm" variant="outline">
              <Link href={listHref}>
                {p.kind === "agent" ? <Bot className="size-4" aria-hidden /> : null}
                {p.kind === "agent" ? "Open AI Agents" : "Open list"}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function Fact({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="mb-0.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </dt>
      <dd className="font-medium text-foreground">{children}</dd>
    </div>
  )
}

function StatusPill({ tone, label }: { tone: "pending" | "working" | "done" | "stopped"; label: string }) {
  const Icon = tone === "done" ? CheckCircle2 : tone === "stopped" ? XCircle : tone === "working" ? Loader2 : Clock3
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        tone === "pending" && "border-primary/30 bg-background text-primary",
        tone === "working" && "border-border bg-background text-foreground",
        tone === "done" && "border-success/30 bg-success/10 text-success",
        tone === "stopped" && "border-border bg-muted text-muted-foreground"
      )}
    >
      <Icon className={cn("size-3", tone === "working" && "animate-spin")} aria-hidden />
      {label}
    </span>
  )
}
