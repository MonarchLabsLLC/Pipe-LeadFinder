"use client"

import { useEffect, useState, useRef } from "react"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { TableCell, TableRow } from "@/components/ui/table"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { formatRelativeTime, getInitials } from "@/lib/format"
import {
  ExternalLink,
  Facebook,
  Flame,
  Linkedin,
  Loader2,
  Mail,
  MessageSquareText,
  MapPin,
  Phone,
  PhoneCall,
  Plus,
  Radar,
  Sparkles,
  Target,
} from "lucide-react"
import { LeadAIActions } from "@/components/leads/lead-ai-actions"
import { useEnrichEmail, useEnrichPhone } from "@/hooks/useEnrich"
import { useLabels, useApplyLabel } from "@/hooks/useLabels"
import { appToast } from "@/lib/app-toast"
import type { LeadScoreSummary } from "@/lib/lead-score"

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
  leadScore: LeadScoreSummary | null
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

function scoreTone(score: number) {
  if (score >= 80) {
    return {
      icon: Flame,
      labelClass: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
      barClass: "bg-emerald-500",
    }
  }
  if (score >= 60) {
    return {
      icon: Target,
      labelClass: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
      barClass: "bg-blue-500",
    }
  }
  if (score >= 40) {
    return {
      icon: Radar,
      labelClass: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
      barClass: "bg-amber-500",
    }
  }
  return {
    icon: Sparkles,
    labelClass: "bg-muted text-muted-foreground border-border",
    barClass: "bg-muted-foreground",
  }
}

function LeadScoreCell({ score }: { score: LeadScoreSummary | null }) {
  if (!score) {
    return (
      <div className="space-y-1">
        <Badge variant="outline" className="text-[11px]">
          Not scored
        </Badge>
        <p className="text-xs text-muted-foreground">Run Score Leads</p>
      </div>
    )
  }

  const tone = scoreTone(score.score)
  const Icon = tone.icon

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="w-full max-w-[190px] rounded-md border border-transparent p-1.5 text-left transition-colors hover:border-border hover:bg-muted/40">
          <div className="flex items-center gap-2">
            <Badge className={tone.labelClass}>
              <Icon className="mr-1 size-3" />
              {score.score}
            </Badge>
            <span className="text-xs font-medium text-foreground">
              {score.label}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${tone.barClass}`}
              style={{ width: `${score.score}%` }}
            />
          </div>
          {score.bestAngle && (
            <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
              {score.bestAngle}
            </p>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Lead fit score</p>
              <p className="text-xs text-muted-foreground">
                {score.model ? `Scored with ${score.model}` : "AI-ranked lead"}
              </p>
            </div>
            <Badge className={tone.labelClass}>{score.score}/100</Badge>
          </div>

          {score.why.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase text-muted-foreground">
                Why this lead
              </p>
              <ul className="space-y-1 text-sm text-foreground">
                {score.why.map((reason, index) => (
                  <li key={`${reason}-${index}`} className="flex gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {score.suggestedOpener && (
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <MessageSquareText className="size-3.5" />
                Suggested opener
              </div>
              <p className="text-sm text-foreground">{score.suggestedOpener}</p>
            </div>
          )}

          {score.nextAction && (
            <div className="flex items-start gap-2 text-sm">
              <Target className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{score.nextAction}</span>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function LeadRow({ lead, selected, onSelectChange }: LeadRowProps) {
  const name = displayName(lead)
  const loc = locationText(lead)

  // Enrichment hooks
  const enrichEmail = useEnrichEmail()
  const enrichPhone = useEnrichPhone()

  // Label hooks
  const { data: availableLabels = [] } = useLabels()
  const applyLabel = useApplyLabel()

  // Manual phone input state
  const [showPhoneInput, setShowPhoneInput] = useState(false)
  const [phoneValue, setPhoneValue] = useState("")
  const [manualPhone, setManualPhone] = useState<string | null>(lead.phone)
  const phoneInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (lead.phone) setManualPhone(lead.phone)
  }, [lead.phone])

  // Label popover state
  const [labelPopoverOpen, setLabelPopoverOpen] = useState(false)

  const handleEnrichEmail = () => {
    enrichEmail.mutate(
      { leadId: lead.id },
      {
        onSuccess: () => {
          appToast.success(
            "Email lookup started",
            "We’ll update this lead when enrichment returns."
          )
        },
        onError: (error) => {
          appToast.error("emailEnrichment", error)
        },
      }
    )
  }

  const handleEnrichPhone = () => {
    enrichPhone.mutate(
      { leadId: lead.id },
      {
        onSuccess: () => {
          appToast.success(
            "Phone lookup started",
            "We’ll update this lead when enrichment returns."
          )
        },
        onError: (error) => {
          appToast.error("phoneEnrichment", error)
        },
      }
    )
  }

  const handleAddPhoneManual = async (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      setShowPhoneInput(false)
      return
    }

    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: trimmed, phoneStatus: "FOUND" }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to save phone")
      }
      appToast.success("Phone number saved", "This lead now has a saved phone.")
      setManualPhone(trimmed)
      setShowPhoneInput(false)
      setPhoneValue("")
    } catch (error) {
      appToast.error("savePhone", error)
    }
  }

  const handleApplyLabel = (labelId: string) => {
    applyLabel.mutate(
      { entryId: lead.entryId, labelId },
      {
        onSuccess: () => {
          appToast.success("Label applied", "This lead was updated.")
          setLabelPopoverOpen(false)
        },
        onError: (error) => {
          appToast.error("applyLabel", error)
        },
      }
    )
  }

  // Filter out labels already applied to this lead
  const appliedLabelIds = new Set(lead.labels.map((l) => l.id))
  const unappliedLabels = availableLabels.filter(
    (l) => !appliedLabelIds.has(l.id)
  )

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

      {/* Lead Score */}
      <TableCell>
        <LeadScoreCell score={lead.leadScore} />
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
              <Button
                variant="outline"
                size="xs"
                disabled={enrichEmail.isPending}
                onClick={handleEnrichEmail}
              >
                {enrichEmail.isPending ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Mail className="size-3" />
                )}
                {enrichEmail.isPending ? "Finding..." : "Add Email"}
              </Button>
              <p className="text-xs text-destructive">No Email Found</p>
            </div>
          )}

          {/* Phone section */}
          {manualPhone ? (
            <span className="text-sm text-foreground block">{manualPhone}</span>
          ) : showPhoneInput ? (
            <div className="flex gap-1 items-center">
              <Input
                ref={phoneInputRef}
                type="tel"
                placeholder="Enter phone..."
                className="h-7 w-32 text-xs"
                value={phoneValue}
                onChange={(e) => setPhoneValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddPhoneManual(phoneValue)
                  }
                  if (e.key === "Escape") {
                    setShowPhoneInput(false)
                    setPhoneValue("")
                  }
                }}
                onBlur={() => handleAddPhoneManual(phoneValue)}
                autoFocus
              />
            </div>
          ) : (
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="xs"
                disabled={enrichPhone.isPending}
                onClick={handleEnrichPhone}
              >
                {enrichPhone.isPending ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Phone className="size-3" />
                )}
                {enrichPhone.isPending ? "Finding..." : "Get Phone"}
              </Button>
              <Button
                variant="outline"
                size="xs"
                onClick={() => {
                  setShowPhoneInput(true)
                }}
              >
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
          <Popover open={labelPopoverOpen} onOpenChange={setLabelPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="xs"
                disabled={applyLabel.isPending}
              >
                {applyLabel.isPending ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Plus className="size-3" />
                )}
                Add
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="start">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground px-2 py-1">
                  Apply label
                </p>
                {unappliedLabels.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-2 py-1">
                    {availableLabels.length === 0
                      ? "No labels created yet"
                      : "All labels applied"}
                  </p>
                ) : (
                  unappliedLabels.map((label) => (
                    <button
                      key={label.id}
                      className="w-full text-left text-sm px-2 py-1.5 rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
                      disabled={applyLabel.isPending}
                      onClick={() => handleApplyLabel(label.id)}
                    >
                      {label.name}
                    </button>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
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
