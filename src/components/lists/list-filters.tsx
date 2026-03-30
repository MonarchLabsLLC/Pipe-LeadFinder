"use client"

import { cn } from "@/lib/utils"
import type { SearchType } from "@/generated/prisma/enums"

type FilterValue = SearchType | "ALL"

interface FilterTab {
  value: FilterValue
  label: string
}

const filterTabs: FilterTab[] = [
  { value: "ALL", label: "All" },
  { value: "PEOPLE", label: "People" },
  { value: "DOMAIN", label: "Domain" },
  { value: "LOCAL", label: "Local" },
  { value: "COMPANY", label: "Company" },
  { value: "INFLUENCER", label: "Influencer" },
]

interface ListFiltersProps {
  counts: Record<FilterValue, number>
  activeFilter: FilterValue
  onFilterChange: (filter: FilterValue) => void
}

export function ListFilters({
  counts,
  activeFilter,
  onFilterChange,
}: ListFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {filterTabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onFilterChange(tab.value)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all",
            activeFilter === tab.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {tab.label}
          <span
            className={cn(
              "text-xs tabular-nums",
              activeFilter === tab.value
                ? "text-primary-foreground/70"
                : "text-muted-foreground/50"
            )}
          >
            {counts[tab.value] ?? 0}
          </span>
        </button>
      ))}
    </div>
  )
}

export type { FilterValue }
