"use client"

import { Check } from "lucide-react"
import type { SearchType } from "@/generated/prisma/enums"
import { cn } from "@/lib/utils"
import {
  formatDisplayCredits,
  getPipeLeadsCreditCost,
  getScaledDisplayCredits,
} from "@/lib/pipeleads-credit-pricing"
import { usePipeLeadsPricing } from "@/hooks/usePipeLeadsPricing"
import {
  SEARCH_GUIDE,
  type SearchExample,
  type SearchGuideEntry,
} from "@/components/search/search-guide"

interface SearchTypePickerProps {
  selectedType: SearchType | null
  onSelect: (type: SearchType) => void
  /** An example chip was clicked: open that search pre-filled. */
  onExample: (type: SearchType, example: SearchExample) => void
}

/**
 * The five searches as scannable rows: what each finds, who it is for, what
 * comes back, an example to try and the live price. One column on phones.
 */
export function SearchTypePicker({ selectedType, onSelect, onExample }: SearchTypePickerProps) {
  const { pricingMap } = usePipeLeadsPricing()

  return (
    <div role="list" aria-label="Search types" className="grid gap-2">
      {SEARCH_GUIDE.map((entry) => (
        <SearchTypeRow
          key={entry.type}
          entry={entry}
          creditsPerResult={getScaledDisplayCredits(
            getPipeLeadsCreditCost(entry.creditAction, pricingMap)
          )}
          isSelected={selectedType === entry.type}
          hasSelection={selectedType !== null}
          onSelect={onSelect}
          onExample={onExample}
        />
      ))}
    </div>
  )
}

function SearchTypeRow({
  entry,
  creditsPerResult,
  isSelected,
  hasSelection,
  onSelect,
  onExample,
}: {
  entry: SearchGuideEntry
  creditsPerResult: number
  isSelected: boolean
  hasSelection: boolean
  onSelect: (type: SearchType) => void
  onExample: (type: SearchType, example: SearchExample) => void
}) {
  const Icon = entry.icon

  return (
    <div
      role="listitem"
      className={cn(
        "group relative grid gap-3 rounded-xl border bg-card p-4 text-card-foreground shadow-sm transition-[box-shadow,border-color,opacity]",
        "hover:border-primary/40 hover:shadow-md",
        "lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1.1fr)_8.5rem] lg:items-center lg:gap-6 lg:py-3.5",
        isSelected && "border-primary ring-1 ring-primary",
        hasSelection && !isSelected && "opacity-70 hover:opacity-100"
      )}
    >
      {/* Headline — the whole row is this button's hit area. */}
      <button
        type="button"
        onClick={() => onSelect(entry.type)}
        aria-pressed={isSelected}
        className="flex min-w-0 items-start gap-3 text-left outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring"
      >
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors",
            isSelected && "bg-primary text-primary-foreground"
          )}
        >
          {isSelected ? <Check className="size-4" strokeWidth={3} aria-hidden /> : <Icon className="size-4" aria-hidden />}
        </span>
        <span className="min-w-0">
          <span className="block text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
            {entry.name}
          </span>
          <span className="block text-sm font-semibold">{entry.headline}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            <span className="sr-only">Best for: </span>
            {entry.bestFor}
          </span>
        </span>
      </button>

      <dl className="min-w-0 pl-12 text-xs lg:pl-0">
        <dt className="text-muted-foreground">You get</dt>
        <dd className="font-medium text-foreground">{entry.youGet}</dd>
      </dl>

      <div className="relative z-10 flex min-w-0 flex-wrap gap-1.5 pl-12 lg:pl-0">
        {entry.examples.slice(0, 2).map((example) => (
          <button
            key={example.label}
            type="button"
            onClick={() => onExample(entry.type, example)}
            className="rounded-lg border border-dashed border-primary/40 bg-primary/5 px-2.5 py-0.5 text-left text-xs leading-snug text-primary transition-colors hover:border-primary hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Try “{example.label}”
          </button>
        ))}
      </div>

      <p className="pl-12 text-xs text-muted-foreground tabular-nums lg:pl-0 lg:text-right">
        <span className="font-medium text-foreground">{formatDisplayCredits(creditsPerResult)} credits</span>{" "}
        per {entry.creditUnit}
        <span className="lg:hidden"> · </span>
        <span className="lg:block lg:text-[0.7rem]">charged only for results</span>
      </p>
    </div>
  )
}
