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
  // Pressed-state buttons in the Suite's segmented control, not tabs: the
  // lists below are not a tab panel.
  return (
    <div className="max-w-full overflow-x-auto">
      <div
        role="group"
        aria-label="Filter lists by type"
        className="inline-flex h-9 shrink-0 items-center rounded-lg bg-muted p-[3px]"
      >
        {filterTabs.map((tab) => {
          const active = activeFilter === tab.value
          return (
            <button
              key={tab.value}
              type="button"
              aria-pressed={active}
              onClick={() => onFilterChange(tab.value)}
              className={cn(
                "inline-flex h-full items-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              <span className="text-xs tabular-nums text-muted-foreground">
                {counts[tab.value] ?? 0}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export type { FilterValue }
