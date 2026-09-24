import { Skeleton } from "@/components/ui/skeleton"

export function ListCardSkeleton() {
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-4 w-48" />
      <div className="flex items-center gap-4 pt-1">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="h-3 w-28" />
    </div>
  )
}

export function TableRowSkeleton({ columns = 7 }: { columns?: number }) {
  return (
    <div className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0">
      <Skeleton className="h-4 w-4 shrink-0 rounded" />
      <div className="flex items-center gap-3 flex-1">
        <Skeleton className="h-10 w-10 rounded-full shrink-0" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      {Array.from({ length: columns - 2 }).map((_, i) => (
        <div key={i} className="flex-1 hidden sm:block">
          <Skeleton className="h-4 w-full max-w-[120px]" />
        </div>
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-md border bg-card" aria-busy aria-label="Loading">
      {/* Header */}
      <div className="flex h-10 items-center gap-4 border-b px-4">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-20 hidden sm:block" />
        <Skeleton className="h-4 w-24 hidden sm:block" />
        <Skeleton className="h-4 w-20 hidden sm:block" />
        <Skeleton className="h-4 w-24 hidden sm:block" />
        <Skeleton className="h-4 w-20 hidden sm:block" />
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <TableRowSkeleton key={i} />
      ))}
    </div>
  )
}

export function SearchFormSkeleton() {
  return (
    <div className="space-y-6 rounded-xl border bg-card p-6 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
      <Skeleton className="h-8 w-36" />
      <div className="flex gap-3">
        <Skeleton className="h-10 w-28" />
        <Skeleton className="h-10 w-20" />
      </div>
    </div>
  )
}
