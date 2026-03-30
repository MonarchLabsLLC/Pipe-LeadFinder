"use client"

import { useState, useMemo } from "react"
import { useParams } from "next/navigation"
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
  Sparkles,
  Users,
} from "lucide-react"
import { TableSkeleton } from "@/components/ui/loading-skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"

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
  const [emailFilter, setEmailFilter] = useState<EmailFilter>("ALL")

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
        <Button variant="outline" size="sm">
          <Clock className="size-4" />
          History
        </Button>

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

        <Button variant="outline" size="sm">
          <Sparkles className="size-4" />
          Data Enrichment
        </Button>
        <Button variant="outline" size="sm">
          <Bot className="size-4" />
          AI Agent
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(`/api/lists/${listId}/export`, "_blank")}
        >
          <Download className="size-4" />
          Export CSV
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
