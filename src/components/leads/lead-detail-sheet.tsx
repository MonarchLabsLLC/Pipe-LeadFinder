"use client"

import type { ComponentType, ReactNode } from "react"
import {
  Building2,
  ExternalLink,
  Facebook,
  Globe,
  Heart,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  Music2,
  Phone,
  Twitter,
  Users,
  Youtube,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { LeadAIActions } from "@/components/leads/lead-ai-actions"
import { LeadLabelPicker } from "@/components/leads/lead-label-picker"
import { getInitials } from "@/lib/format"
import {
  formatFollowerCount,
  leadProfileLinks,
  platformLabel,
  type LeadProfileKind,
} from "@/lib/lead-profile"
import type { LeadData } from "@/components/leads/lead-row"

export const PROFILE_ICONS: Record<LeadProfileKind, ComponentType<{ className?: string }>> = {
  tiktok: Music2,
  instagram: Instagram,
  youtube: Youtube,
  linkedin: Linkedin,
  facebook: Facebook,
  twitter: Twitter,
  website: Globe,
}

interface LeadDetailSheetProps {
  lead: LeadData
  name: string
  location: string | null
  phone: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  )
}

export function LeadDetailSheet({ lead, name, location, phone, open, onOpenChange }: LeadDetailSheetProps) {
  const links = leadProfileLinks(lead)
  const platform = platformLabel(lead.platform)
  const followers = formatFollowerCount(lead.followerCount)
  const handle = lead.username ? `@${lead.username.replace(/^@/, "")}` : null
  const subtitle = lead.title || lead.headline || (platform && handle ? `${platform} creator ${handle}` : null)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="border-b">
          <div className="flex items-center gap-3 pr-6">
            <Avatar size="lg">
              {lead.avatarUrl && <AvatarImage src={lead.avatarUrl} alt={name} />}
              <AvatarFallback className="bg-primary/10 font-medium text-primary">{getInitials(name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <SheetTitle className="truncate">{name}</SheetTitle>
              {subtitle ? (
                <SheetDescription className="line-clamp-2">{subtitle}</SheetDescription>
              ) : (
                <SheetDescription className="sr-only">Lead details</SheetDescription>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-6">
          {(platform || followers || lead.engagementRate != null || location) && (
            <div className="flex flex-wrap gap-2">
              {platform && <Badge variant="secondary">{platform}{handle ? ` · ${handle}` : ""}</Badge>}
              {followers && (
                <Badge variant="outline" className="gap-1">
                  <Users className="size-3" /> {followers} followers
                </Badge>
              )}
              {lead.engagementRate != null && (
                <Badge variant="outline" className="gap-1">
                  <Heart className="size-3" /> {lead.engagementRate}% engagement
                </Badge>
              )}
              {location && (
                <Badge variant="outline" className="gap-1">
                  <MapPin className="size-3" /> {location}
                </Badge>
              )}
            </div>
          )}

          {lead.bio && (
            <Section title="Bio">
              <p className="text-sm whitespace-pre-line text-foreground">{lead.bio}</p>
            </Section>
          )}

          <Section title="Profiles">
            {links.length === 0 ? (
              <p className="text-sm text-muted-foreground">No public profile links were found for this lead.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {links.map((link) => {
                  const Icon = PROFILE_ICONS[link.kind]
                  return (
                    <a
                      key={link.url}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent"
                    >
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="font-medium">{link.label}</span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">{link.url.replace(/^https?:\/\/(www\.)?/, "")}</span>
                      <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                    </a>
                  )
                })}
              </div>
            )}
          </Section>

          <Section title="Contact">
            <div className="space-y-1.5 text-sm">
              <p className="flex items-center gap-2">
                <Mail className="size-4 shrink-0 text-muted-foreground" />
                {lead.email ? (
                  <a href={`mailto:${lead.email}`} className="truncate hover:underline">{lead.email}</a>
                ) : (
                  <span className="text-muted-foreground">
                    {lead.emailStatus === "UNKNOWN" ? "No email looked up yet" : "No email found"}
                  </span>
                )}
              </p>
              <p className="flex items-center gap-2">
                <Phone className="size-4 shrink-0 text-muted-foreground" />
                {phone ? <span>{phone}</span> : <span className="text-muted-foreground">No phone saved</span>}
              </p>
            </div>
          </Section>

          {(lead.companyName || lead.companyIndustry || lead.companySize) && (
            <Section title="Company">
              <div className="space-y-1 text-sm">
                {lead.companyName && (
                  <p className="flex items-center gap-2">
                    <Building2 className="size-4 shrink-0 text-muted-foreground" />
                    {lead.companyName}
                  </p>
                )}
                {(lead.companyIndustry || lead.companySize) && (
                  <p className="text-muted-foreground">
                    {[lead.companyIndustry, lead.companySize ? `${lead.companySize} employees` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>
            </Section>
          )}

          <Section title="Custom labels">
            <LeadLabelPicker entryId={lead.entryId} labels={lead.labels} removable />
          </Section>

          <Section title="AI Assistant">
            <LeadAIActions leadId={lead.id} />
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
