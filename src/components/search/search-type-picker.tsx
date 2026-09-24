"use client"

import { SearchType } from "@/generated/prisma/enums"
import { Users, MapPin, Building2, Globe, Star, Check } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  formatScaledCreditLabel,
  getPipeLeadsCreditCost,
  type PipeLeadsCreditAction,
} from "@/lib/pipeleads-credit-pricing"
import { usePipeLeadsPricing } from "@/hooks/usePipeLeadsPricing"
import type { LucideIcon } from "lucide-react"

interface SearchTypeOption {
  type: SearchType
  title: string
  description: string
  creditAction: PipeLeadsCreditAction
  creditUnit: string
  icon: LucideIcon
}

const searchTypes: SearchTypeOption[] = [
  {
    type: SearchType.PEOPLE,
    title: "People Search",
    description: "Find people in a specific industry and area.",
    creditAction: "search:people",
    creditUnit: "record",
    icon: Users,
  },
  {
    type: SearchType.LOCAL,
    title: "Local Search",
    description: "Find local businesses by type and location.",
    creditAction: "search:local",
    creditUnit: "business",
    icon: MapPin,
  },
  {
    type: SearchType.COMPANY,
    title: "Company Search",
    description: "Gather detailed intelligence on companies.",
    creditAction: "search:company",
    creditUnit: "company",
    icon: Building2,
  },
  {
    type: SearchType.DOMAIN,
    title: "Domain Search",
    description: "Find contacts at a company from its domain.",
    creditAction: "search:domain",
    creditUnit: "contact",
    icon: Globe,
  },
  {
    type: SearchType.INFLUENCER,
    title: "Influencer Search",
    description: "Find influencers by platform, niche, and engagement.",
    creditAction: "search:influencer",
    creditUnit: "profile",
    icon: Star,
  },
]

interface SearchTypePickerProps {
  selectedType: SearchType | null
  onSelect: (type: SearchType) => void
}

export function SearchTypePicker({ selectedType, onSelect }: SearchTypePickerProps) {
  const { pricingMap } = usePipeLeadsPricing()

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
      {searchTypes.map((item) => {
        const creditBadge = formatScaledCreditLabel(
          getPipeLeadsCreditCost(item.creditAction, pricingMap),
          item.creditUnit
        )

        return (
          <SearchTypeCard
            key={item.type}
            item={item}
            creditBadge={creditBadge}
            isSelected={selectedType === item.type}
            hasSelection={selectedType !== null}
            onSelect={onSelect}
          />
        )
      })}
    </div>
  )
}

function SearchTypeCard({
  item,
  creditBadge,
  isSelected,
  hasSelection,
  onSelect,
}: {
  item: SearchTypeOption
  creditBadge: string
  isSelected: boolean
  hasSelection: boolean
  onSelect: (type: SearchType) => void
}) {
  const Icon = item.icon

  return (
    <button
      type="button"
      onClick={() => onSelect(item.type)}
      aria-pressed={isSelected}
      className={cn(
        "relative flex flex-col items-center rounded-xl border bg-card px-4 py-6 text-center text-card-foreground shadow-sm transition-[box-shadow,border-color,opacity]",
        "hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        isSelected && "border-primary ring-1 ring-primary",
        hasSelection && !isSelected && "opacity-60 hover:opacity-100",
      )}
    >
      {isSelected && (
        <span className="absolute top-3 right-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-3" strokeWidth={3} aria-hidden />
        </span>
      )}

      <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" aria-hidden />
      </div>

      <h3 className="mt-3 text-sm font-semibold">{item.title}</h3>

      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
        {item.description}
      </p>

      <Badge variant="secondary" className="mt-3 font-normal text-muted-foreground">
        {creditBadge}
      </Badge>
    </button>
  )
}
