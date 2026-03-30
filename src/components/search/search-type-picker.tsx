"use client"

import { SearchType } from "@/generated/prisma/enums"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, MapPin, Building2, Globe, Star, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface SearchTypeOption {
  type: SearchType
  title: string
  description: string
  creditCost: string
  icon: LucideIcon
}

const searchTypes: SearchTypeOption[] = [
  {
    type: SearchType.PEOPLE,
    title: "People Search",
    description: "Find people in specific industry in the given area.",
    creditCost: "Search will consume 3 credits per record returned, with contact data",
    icon: Users,
  },
  {
    type: SearchType.LOCAL,
    title: "Local Search",
    description: "Find local businesses by type and location.",
    creditCost: "Search will consume 1 credit per company returned",
    icon: MapPin,
  },
  {
    type: SearchType.COMPANY,
    title: "Company Search",
    description: "Find and gather information about companies.",
    creditCost: "Search will consume 1 credit per company returned",
    icon: Building2,
  },
  {
    type: SearchType.DOMAIN,
    title: "Domain Search",
    description: "Find contacts at a specific company from its domain or name.",
    creditCost: "Search will consume 1 credit per individual result returned",
    icon: Globe,
  },
  {
    type: SearchType.INFLUENCER,
    title: "Influencer Search",
    description: "Find social media influencers by platform, niche, and engagement metrics.",
    creditCost: "Search will consume 2 credits per record, +5 for manual enrichment",
    icon: Star,
  },
]

interface SearchTypePickerProps {
  selectedType: SearchType | null
  onSelect: (type: SearchType) => void
}

export function SearchTypePicker({ selectedType, onSelect }: SearchTypePickerProps) {
  const topRow = searchTypes.slice(0, 3)
  const bottomRow = searchTypes.slice(3)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {topRow.map((item) => (
          <SearchTypeCard
            key={item.type}
            item={item}
            isSelected={selectedType === item.type}
            onSelect={onSelect}
          />
        ))}
      </div>
      <div className="mx-auto grid w-full max-w-none gap-4 grid-cols-1 sm:grid-cols-2 sm:max-w-[calc(66.666%+0.5rem)]">
        {bottomRow.map((item) => (
          <SearchTypeCard
            key={item.type}
            item={item}
            isSelected={selectedType === item.type}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  )
}

function SearchTypeCard({
  item,
  isSelected,
  onSelect,
}: {
  item: SearchTypeOption
  isSelected: boolean
  onSelect: (type: SearchType) => void
}) {
  const Icon = item.icon

  return (
    <Card
      className={cn(
        "relative cursor-pointer p-6 transition-all hover:shadow-md hover:border-primary/50",
        isSelected && "border-primary shadow-md"
      )}
      onClick={() => onSelect(item.type)}
    >
      {isSelected && (
        <Badge className="absolute top-3 right-3 h-6 w-6 items-center justify-center rounded-full p-0">
          <Check className="h-3.5 w-3.5" />
        </Badge>
      )}

      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Icon className="h-6 w-6 text-primary" />
        </div>

        <div className="space-y-2">
          <h3 className="text-base font-bold text-foreground">{item.title}</h3>
          <p className="text-sm text-muted-foreground">{item.description}</p>
          <p className="text-xs text-muted-foreground/80">{item.creditCost}</p>
        </div>
      </div>
    </Card>
  )
}
