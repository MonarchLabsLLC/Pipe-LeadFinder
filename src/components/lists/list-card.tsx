"use client"

import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Users,
  MapPin,
  Building2,
  Globe,
  Star,
  Settings,
  Pencil,
  Archive,
  Trash2,
} from "lucide-react"
import type { SearchType } from "@/generated/prisma/enums"
import type { LucideIcon } from "lucide-react"

const typeIcons: Record<SearchType, LucideIcon> = {
  PEOPLE: Users,
  LOCAL: MapPin,
  COMPANY: Building2,
  DOMAIN: Globe,
  INFLUENCER: Star,
}

const typeLabels: Record<SearchType, string> = {
  PEOPLE: "People",
  LOCAL: "Local",
  COMPANY: "Company",
  DOMAIN: "Domain",
  INFLUENCER: "Influencer",
}

function relativeTime(date: string | Date): string {
  const now = Date.now()
  const then = new Date(date).getTime()
  const seconds = Math.floor((now - then) / 1000)

  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months > 1 ? "s" : ""} ago`
  const years = Math.floor(months / 12)
  return `${years} year${years > 1 ? "s" : ""} ago`
}

interface ListCardProps {
  id: string
  name: string
  type: SearchType
  leadCount: number
  emailFoundCount: number
  createdAt: string
  onRename: (id: string) => void
  onArchive: (id: string) => void
  onDelete: (id: string) => void
}

export function ListCard({
  id,
  name,
  type,
  leadCount,
  emailFoundCount,
  createdAt,
  onRename,
  onArchive,
  onDelete,
}: ListCardProps) {
  const router = useRouter()
  const Icon = typeIcons[type]

  return (
    <Card
      className="group relative cursor-pointer p-5 transition-all hover:shadow-md hover:border-primary/50"
      onClick={() => router.push(`/lead-search/saved-lists/${id}`)}
    >
      {/* Settings dropdown */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => e.stopPropagation()}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => onRename(id)}>
              <Pencil className="mr-2 h-4 w-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onArchive(id)}>
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(id)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Card content */}
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 space-y-1">
          <h3 className="text-sm font-semibold text-foreground truncate pr-8">
            {name}
          </h3>
          <p className="text-xs text-muted-foreground">
            Type: {typeLabels[type]}
          </p>
          <p className="text-xs text-muted-foreground">
            All ({leadCount}), Email found ({emailFoundCount})
          </p>
          <p className="text-xs text-muted-foreground/70">
            {relativeTime(createdAt)}
          </p>
        </div>
      </div>
    </Card>
  )
}
