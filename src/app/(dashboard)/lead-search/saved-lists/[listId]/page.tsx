"use client"

import { useState, useMemo } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ResultsTable } from "@/components/lists/results-table"
import type { LeadData } from "@/components/leads/lead-row"
import {
  ArrowLeft,
  Bot,
  Clock,
  Download,
  Loader2,
  Sparkles,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  WandSparkles,
  RotateCcw,
  CalendarClock,
} from "lucide-react"
import { TableSkeleton } from "@/components/ui/loading-skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { useEnrichBulk } from "@/hooks/useEnrich"
import { useScoreLeads } from "@/hooks/useLeadScoring"
import { appToast } from "@/lib/app-toast"
import { JobProgressBanner } from "@/components/jobs/job-progress-banner"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

type EmailFilter = "ALL" | "FOUND" | "NOT_FOUND" | "POTENTIAL"

interface ListDetailResponse {
  list: {
    id: string
    name: string
    type: string
    status: string
    createdAt: string
    updatedAt: string
  }
  leads: LeadData[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  counts: Record<EmailFilter | "UNKNOWN", number>
}

async function fetchListDetail(
  listId: string,
  emailFilter: EmailFilter,
  page: number
): Promise<ListDetailResponse> {
  const params = new URLSearchParams()
  params.set("limit", "100")
  params.set("page", String(page))
  if (emailFilter && emailFilter !== "ALL") {
    params.set("emailFilter", emailFilter)
  }
  const res = await fetch(`/api/lists/${listId}?${params.toString()}`)
  if (!res.ok) throw new Error("Failed to fetch list")
  return res.json()
}

export default function ListDetailPage() {
  const { listId } = useParams<{ listId: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const jobId = searchParams.get("jobId")
  const [emailFilter, setEmailFilter] = useState<EmailFilter>("ALL")
  const [page, setPage] = useState(1)
  const [isExporting, setIsExporting] = useState(false)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)

  const bulkEnrich = useEnrichBulk()
  const scoreLeads = useScoreLeads()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["list-detail", listId, emailFilter, page],
    queryFn: () => fetchListDetail(listId, emailFilter, page),
    enabled: !!listId,
  })

  const counts = useMemo(() => {
    return {
      ALL: data?.counts.ALL ?? 0,
      FOUND: data?.counts.FOUND ?? 0,
      NOT_FOUND: data?.counts.NOT_FOUND ?? 0,
      POTENTIAL: data?.counts.POTENTIAL ?? 0,
    }
  }, [data])

  const displayLeads = useMemo(() => {
    const leads = data?.leads ?? []
    if (!leads.some((lead) => lead.leadScore)) return leads

    return [...leads].sort((a, b) => {
      const aScore = a.leadScore?.score ?? -1
      const bScore = b.leadScore?.score ?? -1
      return bScore - aScore
    })
  }, [data])

  const filterTabs: { value: EmailFilter; label: string }[] = [
    { value: "ALL", label: "All" },
    { value: "FOUND", label: "Email found" },
    { value: "NOT_FOUND", label: "Email not found" },
    { value: "POTENTIAL", label: "Potential" },
  ]

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/lead-search/saved-lists">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-semibold text-foreground">List Details</h1>
        </div>
        <ErrorState
          title="Failed to load list"
          message="This list may have been deleted or you may not have access. Please try again or go back to your saved lists."
          onRetry={() => refetch()}
        />
        <Link href="/lead-search/saved-lists">
          <Button variant="outline">
            <ArrowLeft className="size-4 mr-2" />
            Back to Lists
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <JobProgressBanner
        jobId={jobId || activeJobId}
        onComplete={() => {
          void queryClient.invalidateQueries({ queryKey: ["list-detail", listId] })
          void queryClient.invalidateQueries({ queryKey: ["lists"] })
        }}
      />
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/lead-search/saved-lists">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-5" />
          </Button>
        </Link>
        {isLoading ? (
          <Skeleton className="h-8 w-48" />
        ) : (
          <h1 className="text-2xl font-semibold text-foreground">
            {data?.list.name}
          </h1>
        )}
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2">
        <SearchHistorySheet
          listId={listId as string}
          onJobQueued={setActiveJobId}
        />

        <div className="h-6 w-px bg-border mx-1" />

        {/* Email filter tabs */}
        <div className="flex flex-wrap items-center gap-1">
          {filterTabs.map((tab) => (
            <Button
              key={tab.value}
              variant={emailFilter === tab.value ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setEmailFilter(tab.value)
                setPage(1)
              }}
            >
              {tab.label}
              <Badge
                variant={emailFilter === tab.value ? "secondary" : "outline"}
                className="ml-1.5 px-1.5 py-0 text-[10px] leading-4"
              >
                {counts[tab.value]}
              </Badge>
            </Button>
          ))}
        </div>

        <div className="h-6 w-px bg-border mx-1" />

        <Button
          variant="outline"
          size="sm"
          disabled={bulkEnrich.isPending}
          onClick={() => {
            bulkEnrich.mutate(
              { listId },
              {
                onSuccess: (result) => {
                  if (result.jobId) {
                    setActiveJobId(result.jobId)
                    appToast.success(
                      "Enrichment queued",
                      "Progress will continue safely in the background."
                    )
                    return
                  }
                  appToast.success(
                    "Data enrichment complete",
                    result.enriched > 0
                      ? `${result.enriched} email${result.enriched === 1 ? "" : "s"} found from ${result.attempted ?? result.total} checked.`
                      : `No new emails found from ${result.attempted ?? result.total} checked.`
                  )
                  refetch()
                },
                onError: (err) => {
                  appToast.error("bulkEnrichment", err)
                },
              }
            )
          }}
        >
          {bulkEnrich.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {bulkEnrich.isPending ? "Enriching..." : "Data Enrichment"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={scoreLeads.isPending || !data?.counts.ALL}
          onClick={() => {
            scoreLeads.mutate(
              { listId },
              {
                onSuccess: (result) => {
                  if (result.jobId) {
                    setActiveJobId(result.jobId)
                    appToast.success(
                      "Lead scoring queued",
                      "Progress will continue safely in the background."
                    )
                    return
                  }
                  const scoredCount = result.scoredCount ?? 0
                  appToast.success(
                    scoredCount > 0 ? "Lead scoring complete" : "No leads scored",
                    scoredCount > 0
                      ? `${scoredCount} leads were ranked by fit.`
                      : result.message || "No leads to score"
                  )
                  refetch()
                },
                onError: (err) => {
                  appToast.error("leadScoring", err)
                },
              }
            )
          }}
        >
          {scoreLeads.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <WandSparkles className="size-4" />
          )}
          {scoreLeads.isPending ? "Scoring..." : "Score Leads"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/ai/ai-agent")}
        >
          <Bot className="size-4" />
          AI Agent
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={isExporting}
          onClick={async () => {
            setIsExporting(true)
            try {
              const res = await fetch(`/api/lists/${listId}/export`)
              if (!res.ok) throw new Error("Export failed")
              const blob = await res.blob()
              const url = URL.createObjectURL(blob)
              const a = document.createElement("a")
              a.href = url
              a.download = `${data?.list.name || "leads"}.csv`
              document.body.appendChild(a)
              a.click()
              document.body.removeChild(a)
              URL.revokeObjectURL(url)
              appToast.success(
                "CSV export ready",
                "Your lead list download has started."
              )
            } catch (err) {
              appToast.error("exportCsv", err)
            } finally {
              setIsExporting(false)
            }
          }}
        >
          {isExporting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          {isExporting ? "Exporting..." : "Export CSV"}
        </Button>
      </div>

      {/* Table or states */}
      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : displayLeads.length > 0 ? (
        <ResultsTable
          leads={displayLeads}
          listId={listId}
          listType={data!.list.type as import("@/generated/prisma/enums").SearchType}
          onJobQueued={setActiveJobId}
        />
      ) : emailFilter !== "ALL" ? (
        <EmptyState
          icon={Users}
          title="No matching leads"
          description={`No leads matching the "${filterTabs.find((t) => t.value === emailFilter)?.label}" filter. Try selecting a different filter.`}
        />
      ) : (
        <EmptyState
          icon={Users}
          title="No leads in this list yet"
          description="Run a search to add leads to this list, or use the enrichment tools to populate contact data."
        />
      )}

      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Page {data.pagination.page} of {data.pagination.totalPages} ·{" "}
            {data.pagination.total} leads
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.pagination.totalPages || isLoading}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Search History Sheet ─────────────────────────────────

interface HistoryEntry {
  id: string
  searchType: string
  parameters: Record<string, unknown>
  resultCount: number
  status: string
  createdAt: string
}

function SearchHistorySheet({
  listId,
  onJobQueued,
}: {
  listId: string
  onJobQueued: (jobId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const historyQuery = useQuery({
    queryKey: ["history", listId, open],
    queryFn: async (): Promise<HistoryEntry[]> => {
      const res = await fetch(`/api/lists/${listId}/history`)
      if (!res.ok) throw new Error("Failed to load search history")
      return res.json()
    },
    enabled: open,
  })

  const statusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle2 className="size-4 text-green-600" />
      case "FAILED":
        return <XCircle className="size-4 text-destructive" />
      case "RUNNING":
        return <Loader2 className="size-4 animate-spin text-primary" />
      default:
        return <AlertCircle className="size-4 text-muted-foreground" />
    }
  }

  const formatParams = (params: Record<string, unknown>) => {
    const parts: string[] = []
    if (params.description) parts.push(String(params.description))
    if (params.location) parts.push(String(params.location))
    return parts.join(" · ") || "—"
  }

  const timeAgo = (dateStr: string, now: number) => {
    if (!now) return ""
    const diff = now - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return "just now"
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  async function rerun(entry: HistoryEntry) {
    setBusyId(entry.id)
    try {
      const response = await fetch(`/api/search/${entry.id}/rerun`, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Saved search could not be rerun")
      onJobQueued(result.jobId)
      setOpen(false)
      appToast.success("Search queued", "The saved criteria are running again in the background.")
    } catch (error) {
      appToast.error("searchHistory", error)
    } finally {
      setBusyId(null)
    }
  }

  async function schedule(entry: HistoryEntry) {
    setBusyId(entry.id)
    try {
      const response = await fetch(`/api/search/${entry.id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule: "weekly" }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Schedule could not be created")
      appToast.success("Weekly search scheduled", "You can adjust or pause it from AI Agents.")
    } catch (error) {
      appToast.error("searchHistory", error)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Clock className="size-4" />
          History
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[450px]">
        <SheetHeader>
          <SheetTitle>Search History</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3 overflow-y-auto max-h-[calc(100vh-120px)]">
          {historyQuery.isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {historyQuery.isError && (
            <div className="py-8 text-center text-sm text-destructive">
              Search history could not be loaded.
              <Button variant="link" className="ml-1 h-auto p-0" onClick={() => historyQuery.refetch()}>
                Try again
              </Button>
            </div>
          )}
          {historyQuery.data && historyQuery.data.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <Search className="size-8 mx-auto mb-2 opacity-40" />
              No searches yet for this list
            </div>
          )}
          {historyQuery.data?.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-3 p-3 border border-border bg-card"
            >
              <div className="mt-0.5">{statusIcon(entry.status)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {entry.searchType}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {timeAgo(entry.createdAt, historyQuery.dataUpdatedAt)}
                  </span>
                </div>
                <p className="text-sm mt-1 truncate">
                  {formatParams(entry.parameters)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {entry.resultCount} result{entry.resultCount !== 1 ? "s" : ""}
                </p>
                {entry.status === "COMPLETED" && (
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === entry.id}
                      onClick={() => rerun(entry)}
                    >
                      {busyId === entry.id ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                      Run again
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === entry.id}
                      onClick={() => schedule(entry)}
                    >
                      <CalendarClock className="size-3.5" />
                      Weekly
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
