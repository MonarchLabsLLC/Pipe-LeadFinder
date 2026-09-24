"use client"

import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Users,
  MapPin,
  Building2,
  Globe,
  Star,
  MoreHorizontal,
  Mail,
  Pencil,
  Archive,
  ArchiveRestore,
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
  archived?: boolean
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
  archived = false,
}: ListCardProps) {
  const router = useRouter()
  const Icon = typeIcons[type]

  return (
    <Card
      className="group relative cursor-pointer gap-0 overflow-hidden py-0 transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-ring"
      onClick={() => router.push(`/lead-search/saved-lists/${id}`)}
    >
      <CardContent className="flex min-h-36 flex-col p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-base font-semibold">{name}</h3>
            <Badge variant="secondary" className="mt-1">
              {typeLabels[type]}
            </Badge>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative z-10 size-8 shrink-0"
                aria-label={`Actions for ${name}`}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => onRename(id)}>
                <Pencil className="mr-2 size-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onArchive(id)}>
                {archived ? (
                  <ArchiveRestore className="mr-2 size-4" />
                ) : (
                  <Archive className="mr-2 size-4" />
                )}
                {archived ? "Restore" : "Archive"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 tabular-nums">
            <Users className="size-3.5" aria-hidden />
            {leadCount} {leadCount === 1 ? "lead" : "leads"}
          </span>
          <span className="flex items-center gap-1 tabular-nums">
            <Mail className="size-3.5" aria-hidden />
            {emailFoundCount} with email
          </span>
          <span className="ml-auto">{relativeTime(createdAt)}</span>
        </div>
      </CardContent>
    </Card>
  )
}
