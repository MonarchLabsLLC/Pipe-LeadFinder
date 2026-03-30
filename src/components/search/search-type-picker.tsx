"use client"

import { SearchType } from "@/generated/prisma/enums"
import { Users, MapPin, Building2, Globe, Star, Check, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface SearchTypeOption {
  type: SearchType
  title: string
  description: string
  creditBadge: string
  icon: LucideIcon
  accentFrom: string
  accentTo: string
  accentBg: string
  accentBorder: string
}

const searchTypes: SearchTypeOption[] = [
  {
    type: SearchType.PEOPLE,
    title: "People Search",
    description: "Find people in a specific industry and area.",
    creditBadge: "3 credits / record",
    icon: Users,
    accentFrom: "oklch(0.769 0.188 70.08)",
    accentTo: "oklch(0.666 0.179 58.318)",
    accentBg: "oklch(0.769 0.188 70.08 / 0.12)",
    accentBorder: "oklch(0.769 0.188 70.08 / 0.6)",
  },
  {
    type: SearchType.LOCAL,
    title: "Local Search",
    description: "Find local businesses by type and location.",
    creditBadge: "1 credit / company",
    icon: MapPin,
    accentFrom: "oklch(0.723 0.15 155)",
    accentTo: "oklch(0.600 0.14 155)",
    accentBg: "oklch(0.723 0.15 155 / 0.12)",
    accentBorder: "oklch(0.723 0.15 155 / 0.6)",
  },
  {
    type: SearchType.COMPANY,
    title: "Company Search",
    description: "Gather detailed intelligence on companies.",
    creditBadge: "1 credit / company",
    icon: Building2,
    accentFrom: "oklch(0.7 0.15 240)",
    accentTo: "oklch(0.58 0.14 240)",
    accentBg: "oklch(0.7 0.15 240 / 0.12)",
    accentBorder: "oklch(0.7 0.15 240 / 0.6)",
  },
  {
    type: SearchType.DOMAIN,
    title: "Domain Search",
    description: "Find contacts at a company from its domain.",
    creditBadge: "1 credit / result",
    icon: Globe,
    accentFrom: "oklch(0.7 0.15 295)",
    accentTo: "oklch(0.58 0.14 295)",
    accentBg: "oklch(0.7 0.15 295 / 0.12)",
    accentBorder: "oklch(0.7 0.15 295 / 0.6)",
  },
  {
    type: SearchType.INFLUENCER,
    title: "Influencer Search",
    description: "Find influencers by platform, niche, and engagement.",
    creditBadge: "2 credits / record",
    icon: Star,
    accentFrom: "oklch(0.72 0.17 10)",
    accentTo: "oklch(0.62 0.16 350)",
    accentBg: "oklch(0.72 0.17 10 / 0.12)",
    accentBorder: "oklch(0.72 0.17 10 / 0.6)",
  },
]

interface SearchTypePickerProps {
  selectedType: SearchType | null
  onSelect: (type: SearchType) => void
}

export function SearchTypePicker({ selectedType, onSelect }: SearchTypePickerProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:gap-4">
      {searchTypes.map((item) => (
        <SearchTypeCard
          key={item.type}
          item={item}
          isSelected={selectedType === item.type}
          hasSelection={selectedType !== null}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

function SearchTypeCard({
  item,
  isSelected,
  hasSelection,
  onSelect,
}: {
  item: SearchTypeOption
  isSelected: boolean
  hasSelection: boolean
  onSelect: (type: SearchType) => void
}) {
  const Icon = item.icon

  return (
    <button
      type="button"
      onClick={() => onSelect(item.type)}
      className={cn(
        "group relative flex flex-col items-center overflow-hidden rounded-xl border bg-card text-left shadow-sm",
        "transition-all duration-200 ease-out",
        "hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-lg",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "px-4 py-6 sm:px-3 sm:py-7 lg:px-4 lg:py-8",
        isSelected && "-translate-y-0.5 scale-[1.02] shadow-lg",
        hasSelection && !isSelected && "opacity-55",
      )}
      style={{
        borderColor: isSelected ? item.accentBorder : undefined,
      }}
    >
      {/* Top accent gradient bar */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-[3px] transition-all duration-200 ease-out",
          "opacity-50 group-hover:opacity-100",
          isSelected && "opacity-100 h-[3.5px]",
        )}
        style={{
          background: `linear-gradient(to right, ${item.accentFrom}, ${item.accentTo})`,
        }}
      />

      {/* Selected check badge */}
      {isSelected && (
        <div
          className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full"
          style={{ backgroundColor: item.accentFrom }}
        >
          <Check className="h-3 w-3 text-white" strokeWidth={3} />
        </div>
      )}

      {/* Icon container */}
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 ease-out",
          "group-hover:scale-110",
          isSelected && "scale-110",
        )}
        style={{
          backgroundColor: item.accentBg,
        }}
      >
        <Icon
          className="h-5 w-5 transition-colors duration-200"
          style={{ color: item.accentFrom }}
        />
      </div>

      {/* Title */}
      <h3 className="mt-4 text-sm font-semibold text-foreground">
        {item.title}
      </h3>

      {/* Description */}
      <p className="mt-1.5 line-clamp-2 text-center text-xs leading-relaxed text-muted-foreground">
        {item.description}
      </p>

      {/* Credit badge */}
      <span className="mt-3 inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        {item.creditBadge}
      </span>

      {/* Bottom chevron hint */}
      <ChevronRight
        className={cn(
          "mt-3 h-3.5 w-3.5 rotate-90 text-muted-foreground/40 transition-all duration-200",
          "group-hover:text-muted-foreground/70 group-hover:translate-y-0.5",
          isSelected && "text-muted-foreground/70",
        )}
      />

      {/* Subtle hover background tint */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200",
          "group-hover:opacity-100",
          isSelected && "opacity-100",
        )}
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${item.accentBg} 0%, transparent 70%)`,
        }}
      />
    </button>
  )
}
