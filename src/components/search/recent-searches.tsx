"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { History, Loader2, RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { appToast } from "@/lib/app-toast"
import { formatRelativeTime, summarizeSearch } from "@/lib/search-summary"
import { useRecentSearches, useRerunSearch, type RecentSearch } from "@/hooks/useSearchAssist"
import { SEARCH_GUIDE_BY_TYPE } from "@/components/search/search-guide"

/** "Pick up where you left off": the last six searches, with Open and Run again. */
export function RecentSearches() {
  const { data, isLoading, isError } = useRecentSearches()

  return (
    <section aria-labelledby="recent-searches-title" className="space-y-3">
      <div>
        <h2 id="recent-searches-title" className="text-base font-semibold">
          Pick up where you left off
        </h2>
        <p className="text-sm text-muted-foreground">Your latest searches and the lists they filled.</p>
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        {isLoading ? (
          <div className="divide-y">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 p-4">
                <Skeleton className="size-8 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-1/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <p className="p-4 text-sm text-muted-foreground">Recent searches could not be loaded right now.</p>
        ) : !data || data.searches.length === 0 ? (
          <EmptyState
            size="inline"
            icon={History}
            title="Your first search"
            description="Try an example above, or describe who you want. Your searches will show up here."
          />
        ) : (
          <ul className="divide-y">
            {data.searches.map((search) => (
              <RecentSearchRow key={search.id} search={search} canRerun={data.canRerun} />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function statusLabel(search: RecentSearch) {
  if (search.status === "FAILED") return "Failed"
  if (search.status === "PENDING" || search.status === "RUNNING") return "Running"
  return `${search.resultCount.toLocaleString()} ${search.resultCount === 1 ? "result" : "results"}`
}

function RecentSearchRow({ search, canRerun }: { search: RecentSearch; canRerun: boolean }) {
  const router = useRouter()
  const rerun = useRerunSearch()
  const [pending, setPending] = useState(false)
  const guide = SEARCH_GUIDE_BY_TYPE[search.searchType]
  const Icon = guide.icon
  const listId = search.list?.id

  async function handleRerun() {
    setPending(true)
    try {
      const result = await rerun.mutateAsync(search.id)
      appToast.success("Search queued", "The same search is running again into the same list.")
      router.push(`/lead-search/saved-lists/${result.listId}?jobId=${result.jobId}`)
    } catch (error) {
      appToast.error("search", error)
      setPending(false)
    }
  }

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
          title={guide.name}
        >
          <Icon className="size-4" aria-hidden />
          <span className="sr-only">{guide.name}</span>
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {summarizeSearch(search.searchType, search.parameters)}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            <span className={search.status === "FAILED" ? "text-destructive" : undefined}>
              {statusLabel(search)}
            </span>
            {" · "}
            <time dateTime={search.createdAt}>{formatRelativeTime(search.createdAt)}</time>
            {search.list ? <> · {search.list.name}</> : null}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2 pl-11 sm:pl-0">
        {listId ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/lead-search/saved-lists/${listId}`}>Open list</Link>
          </Button>
        ) : null}
        {canRerun && listId ? (
          <Button variant="ghost" size="sm" onClick={handleRerun} disabled={pending}>
            {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <RotateCw className="size-3.5" aria-hidden />}
            Run again
          </Button>
        ) : null}
      </div>
    </li>
  )
}
