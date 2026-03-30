"use client"

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { TableCell, TableRow } from "@/components/ui/table"
import { formatRelativeTime, getInitials } from "@/lib/format"
import {
  ExternalLink,
  Facebook,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  PhoneCall,
  Plus,
} from "lucide-react"
import { LeadAIActions } from "@/components/leads/lead-ai-actions"

export interface LeadData {
  id: string
  entryId: string
  firstName: string | null
  lastName: string | null
  fullName: string | null
  title: string | null
  headline: string | null
  avatarUrl: string | null
  city: string | null
  state: string | null
  country: string | null
  location: string | null
  email: string | null
  emailStatus: "UNKNOWN" | "FOUND" | "NOT_FOUND" | "POTENTIAL"
  phone: string | null
  phoneStatus: "UNKNOWN" | "FOUND" | "NOT_FOUND"
  linkedinUrl: string | null
  facebookUrl: string | null
  twitterUrl: string | null
  instagramUrl: string | null
  companyName: string | null
  companyWebsite: string | null
  companyLinkedin: string | null
  companySize: string | null
  companyIndustry: string | null
  sourceType: string
  createdAt: string
  labels: { id: string; name: string }[]
}

interface LeadRowProps {
  lead: LeadData
  selected: boolean
  onSelectChange: (checked: boolean) => void
}

function displayName(lead: LeadData): string {
  if (lead.fullName) return lead.fullName
  const parts = [lead.firstName, lead.lastName].filter(Boolean)
  return parts.length > 0 ? parts.join(" ") : "Unknown"
}

function locationText(lead: LeadData): string | null {
  if (lead.location) return lead.location
  const parts = [lead.city, lead.state, lead.country].filter(Boolean)
  return parts.length > 0 ? parts.join(", ") : null
}

export function LeadRow({ lead, selected, onSelectChange }: LeadRowProps) {
  const name = displayName(lead)
  const loc = locationText(lead)

  return (
    <TableRow data-state={selected ? "selected" : undefined}>
      {/* Checkbox */}
      <TableCell>
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) => onSelectChange(checked === true)}
          aria-label={`Select ${name}`}
        />
      </TableCell>

      {/* Name */}
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar size="lg">
            {lead.avatarUrl && <AvatarImage src={lead.avatarUrl} alt={name} />}
            <AvatarFallback>{getInitials(name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <button className="text-sm font-medium text-foreground hover:underline truncate block text-left">
              {name}
            </button>
            {lead.title && (
              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                {lead.title}
              </p>
            )}
            {loc && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="size-3 shrink-0" />
                <span className="truncate max-w-[180px]">{loc}</span>
              </p>
            )}
            <div className="flex items-center gap-1 mt-0.5">
              {lead.linkedinUrl && (
                <a
                  href={lead.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-blue-600">
                    <Linkedin className="size-3.5" />
                  </Button>
                </a>
              )}
              {lead.facebookUrl && (
                <a
                  href={lead.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-blue-700">
                    <Facebook className="size-3.5" />
                  </Button>
                </a>
              )}
            </div>
          </div>
        </div>
      </TableCell>

      {/* AI Assistant */}
      <TableCell>
        <LeadAIActions leadId={lead.id} />
      </TableCell>

      {/* Contact Info */}
      <TableCell>
        <div className="space-y-1.5">
          {/* Email section */}
          {lead.emailStatus === "FOUND" && lead.email ? (
            <div className="space-y-1">
              <span className="text-sm text-foreground">{lead.email}</span>
              <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
                Email Found
              </Badge>
            </div>
          ) : lead.emailStatus === "POTENTIAL" ? (
            <div className="space-y-1">
              {lead.email && (
                <span className="text-sm text-foreground">{lead.email}</span>
              )}
              <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800">
                Potential Email
              </Badge>
            </div>
          ) : (
            <div className="space-y-1">
              <Button variant="outline" size="xs">
                <Mail className="size-3" />
                Add Email
              </Button>
              <p className="text-xs text-destructive">No Email Found</p>
            </div>
          )}

          {/* Phone section */}
          {lead.phone ? (
            <span className="text-sm text-foreground block">{lead.phone}</span>
          ) : (
            <div className="flex gap-1">
              <Button variant="outline" size="xs">
                <Phone className="size-3" />
                Get Phone
              </Button>
              <Button variant="outline" size="xs">
                <PhoneCall className="size-3" />
                Add Phone
              </Button>
            </div>
          )}
        </div>
      </TableCell>

      {/* Company */}
      <TableCell>
        <div className="space-y-1">
          {lead.companyName && (
            <div className="flex items-center gap-1.5">
              {lead.companyWebsite ? (
                <a
                  href={lead.companyWebsite.startsWith("http") ? lead.companyWebsite : `https://${lead.companyWebsite}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-foreground hover:underline flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  {lead.companyName}
                  <ExternalLink className="size-3 text-muted-foreground" />
                </a>
              ) : (
                <span className="text-sm text-foreground">{lead.companyName}</span>
              )}
            </div>
          )}
          {lead.companyLinkedin && (
            <a
              href={lead.companyLinkedin}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              <Button variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-blue-600">
                <Linkedin className="size-3.5" />
              </Button>
            </a>
          )}
        </div>
      </TableCell>

      {/* Custom Labels */}
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {lead.labels.map((label) => (
            <Badge key={label.id} variant="secondary">
              {label.name}
            </Badge>
          ))}
          <Button variant="outline" size="xs">
            <Plus className="size-3" />
            Add
          </Button>
        </div>
      </TableCell>

      {/* Created At */}
      <TableCell>
        <span className="text-sm text-muted-foreground">
          {formatRelativeTime(lead.createdAt)}
        </span>
      </TableCell>
    </TableRow>
  )
}
