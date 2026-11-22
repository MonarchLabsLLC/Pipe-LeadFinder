export type LeadProfileKind =
  | "tiktok"
  | "instagram"
  | "youtube"
  | "linkedin"
  | "facebook"
  | "twitter"
  | "website"

export interface LeadProfileLink {
  kind: LeadProfileKind
  label: string
  url: string
}

export interface LeadProfileSource {
  platform?: string | null
  username?: string | null
  tiktokUrl?: string | null
  instagramUrl?: string | null
  youtubeUrl?: string | null
  linkedinUrl?: string | null
  facebookUrl?: string | null
  twitterUrl?: string | null
  companyWebsite?: string | null
}

const PROFILE_FIELDS: Array<{ kind: LeadProfileKind; label: string; field: keyof LeadProfileSource }> = [
  { kind: "tiktok", label: "TikTok", field: "tiktokUrl" },
  { kind: "instagram", label: "Instagram", field: "instagramUrl" },
  { kind: "youtube", label: "YouTube", field: "youtubeUrl" },
  { kind: "linkedin", label: "LinkedIn", field: "linkedinUrl" },
  { kind: "facebook", label: "Facebook", field: "facebookUrl" },
  { kind: "twitter", label: "X (Twitter)", field: "twitterUrl" },
  { kind: "website", label: "Website", field: "companyWebsite" },
]

export function safeExternalUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed.replace(/^\/+/, "")}`
  try {
    const url = new URL(candidate)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    if (!url.hostname.includes(".")) return null
    return url.toString()
  } catch {
    return null
  }
}

/** Every public profile we hold for a lead, the lead's own platform first. */
export function leadProfileLinks(lead: LeadProfileSource): LeadProfileLink[] {
  const links: LeadProfileLink[] = []
  const seen = new Set<string>()
  for (const { kind, label, field } of PROFILE_FIELDS) {
    const url = safeExternalUrl(lead[field])
    if (!url || seen.has(url)) continue
    seen.add(url)
    links.push({ kind, label, url })
  }

  const platform = lead.platform?.trim().toLowerCase()
  if (!platform) return links
  return [
    ...links.filter((link) => link.kind === platform),
    ...links.filter((link) => link.kind !== platform),
  ]
}

export function formatFollowerCount(count: number | null | undefined): string | null {
  if (count === null || count === undefined || !Number.isFinite(count) || count < 0) return null
  if (count < 1_000) return String(Math.round(count))
  if (count < 1_000_000) return `${trimDecimal(count / 1_000)}K`
  return `${trimDecimal(count / 1_000_000)}M`
}

function trimDecimal(value: number): string {
  const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10
  return String(rounded)
}

export function platformLabel(platform: string | null | undefined): string | null {
  switch (platform?.trim().toLowerCase()) {
    case "tiktok":
      return "TikTok"
    case "instagram":
      return "Instagram"
    case "youtube":
      return "YouTube"
    default:
      return null
  }
}
