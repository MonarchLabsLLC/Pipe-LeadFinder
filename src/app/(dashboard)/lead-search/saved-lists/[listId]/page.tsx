"use client"

import { useState, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
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
} from "lucide-react"
import { TableSkeleton } from "@/components/ui/loading-skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { useEnrichBulk } from "@/hooks/useEnrich"
import { toast } from "sonner"
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
}

async function fetchListDetail(
  listId: string,
  emailFilter?: EmailFilter
): Promise<ListDetailResponse> {
  const params = new URLSearchParams()
  params.set("limit", "100")
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
  const [emailFilter, setEmailFilter] = useState<EmailFilter>("ALL")
  const [isExporting, setIsExporting] = useState(false)

  const bulkEnrich = useEnrichBulk()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["list-detail", listId, emailFilter],
    queryFn: () => fetchListDetail(listId, emailFilter),
    enabled: !!listId,
  })

  // Compute counts from the full (ALL) data for the filter tabs
  // We always keep a separate query for ALL to get counts
  const { data: allData } = useQuery({
    queryKey: ["list-detail", listId, "ALL"],
    queryFn: () => fetchListDetail(listId, "ALL"),
    enabled: !!listId,
  })

  const counts = useMemo(() => {
    const leads = allData?.leads ?? []
    return {
      ALL: leads.length,
      FOUND: leads.filter((l) => l.emailStatus === "FOUND").length,
      NOT_FOUND: leads.filter((l) => l.emailStatus === "NOT_FOUND").length,
      POTENTIAL: leads.filter((l) => l.emailStatus === "POTENTIAL").length,
    }
  }, [allData])

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
        <SearchHistorySheet listId={listId as string} />

        <div className="h-6 w-px bg-border mx-1" />

        {/* Email filter tabs */}
        <div className="flex flex-wrap items-center gap-1">
          {filterTabs.map((tab) => (
            <Button
              key={tab.value}
              variant={emailFilter === tab.value ? "default" : "outline"}
              size="sm"
              onClick={() => setEmailFilter(tab.value)}
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
                onSuccess: () => {
                  toast.success("Data enrichment started successfully")
                  refetch()
                },
                onError: (err) => {
                  toast.error(err.message || "Data enrichment failed")
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
              toast.success("CSV exported successfully")
            } catch {
              toast.error("Failed to export CSV")
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
      ) : data && data.leads.length > 0 ? (
        <ResultsTable leads={data.leads} />
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

function SearchHistorySheet({ listId }: { listId: string }) {
  const [open, setOpen] = useState(false)
  const historyQuery = useQuery({
    queryKey: ["history", listId, open],
    queryFn: async (): Promise<HistoryEntry[]> => {
      const res = await fetch(`/api/lists/${listId}/history`)
      if (!res.ok) return []
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

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return "just now"
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
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
                    {timeAgo(entry.createdAt)}
                  </span>
                </div>
                <p className="text-sm mt-1 truncate">
                  {formatParams(entry.parameters)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {entry.resultCount} result{entry.resultCount !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
