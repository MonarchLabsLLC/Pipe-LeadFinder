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

const typeAccentClasses: Record<SearchType, { gradient: string; iconBg: string; iconText: string; badge: string }> = {
  PEOPLE: {
    gradient: "from-amber-400 to-amber-500",
    iconBg: "bg-amber-500/10",
    iconText: "text-amber-600 dark:text-amber-400",
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  LOCAL: {
    gradient: "from-emerald-400 to-emerald-500",
    iconBg: "bg-emerald-500/10",
    iconText: "text-emerald-600 dark:text-emerald-400",
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  COMPANY: {
    gradient: "from-blue-400 to-blue-500",
    iconBg: "bg-blue-500/10",
    iconText: "text-blue-600 dark:text-blue-400",
    badge: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  },
  DOMAIN: {
    gradient: "from-purple-400 to-purple-500",
    iconBg: "bg-purple-500/10",
    iconText: "text-purple-600 dark:text-purple-400",
    badge: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  },
  INFLUENCER: {
    gradient: "from-pink-400 to-pink-500",
    iconBg: "bg-pink-500/10",
    iconText: "text-pink-600 dark:text-pink-400",
    badge: "bg-pink-500/10 text-pink-700 dark:text-pink-400",
  },
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
  const accent = typeAccentClasses[type]

  return (
    <Card
      className="group relative cursor-pointer overflow-hidden rounded-xl border border-border bg-card p-0 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
      onClick={() => router.push(`/lead-search/saved-lists/${id}`)}
    >
      {/* Accent gradient bar */}
      <div className={`h-[3px] w-full bg-gradient-to-r ${accent.gradient}`} />

      {/* Settings dropdown */}
      <div className="absolute top-4 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
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
      <div className="px-5 pt-4 pb-5 space-y-3">
        <div className="flex items-start gap-3.5">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${accent.iconBg}`}>
            <Icon className={`h-5 w-5 ${accent.iconText}`} />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className="text-sm font-semibold text-foreground truncate pr-8">
              {name}
            </h3>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${accent.badge}`}>
              {typeLabels[type]}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            <span className="tabular-nums font-medium text-foreground/80">{leadCount}</span>
            {" leads"}
            <span className="mx-1.5 text-border">&#183;</span>
            <span className="tabular-nums font-medium text-foreground/80">{emailFoundCount}</span>
            {" with email"}
          </p>
          <p className="text-xs text-muted-foreground/60">
            {relativeTime(createdAt)}
          </p>
        </div>
      </div>
    </Card>
  )
}
