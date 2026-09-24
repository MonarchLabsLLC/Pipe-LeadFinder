/**
 * Pure helpers behind the New Search welcome: plain-English summaries of a
 * search's criteria, the auto-generated list name, the cost estimate and a
 * relative "when". No React, no database, so they are shared by the client,
 * the API routes and the tests.
 */

export type SearchTypeKey = "PEOPLE" | "LOCAL" | "COMPANY" | "DOMAIN" | "INFLUENCER"

/** The list selector's value for "create a list for me when I search". */
export const AUTO_LIST_ID = "__auto_new_list__"

/** Matches `createListSchema` (name max 100). */
const MAX_LIST_NAME = 100

const TYPE_LABELS: Record<SearchTypeKey, string> = {
  PEOPLE: "People",
  LOCAL: "Local",
  COMPANY: "Company",
  DOMAIN: "Domain",
  INFLUENCER: "Influencer",
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
}

type Params = Record<string, unknown> | null | undefined

function text(params: Params, key: string): string | undefined {
  const value = params?.[key]
  if (typeof value !== "string") return undefined
  const trimmed = value.trim().replace(/\s+/g, " ")
  return trimmed.length > 0 ? trimmed : undefined
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/** Capitalize the first piece, except a domain ("acme.com" stays lower case). */
function lead(type: SearchTypeKey, part: string) {
  return type === "DOMAIN" ? part : capitalize(part)
}

/** Shorten "Tampa, Hillsborough County, Florida, United States" style places. */
function shortPlace(value: string | undefined) {
  if (!value) return undefined
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean)
  return parts.length > 2 ? parts.slice(0, 2).join(", ") : parts.join(", ")
}

function compactNumber(value: unknown) {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return undefined
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}k`
  return String(n)
}

/** The ordered pieces of a plain-English summary ("Dentist", "Tampa, FL"). */
export function summaryParts(type: SearchTypeKey, params: Params): string[] {
  const parts: (string | undefined)[] = []
  switch (type) {
    case "PEOPLE":
      parts.push(text(params, "description") ?? text(params, "jobTitle"))
      parts.push(text(params, "industry"))
      parts.push(shortPlace(text(params, "location")))
      break
    case "LOCAL":
      parts.push(text(params, "businessType"))
      parts.push(shortPlace(text(params, "location")))
      break
    case "COMPANY": {
      parts.push(
        text(params, "description") ??
          text(params, "companyName") ??
          text(params, "domain") ??
          text(params, "keyword")
      )
      parts.push(text(params, "industry"))
      const size = text(params, "employeeCount")
      parts.push(size ? `${size} staff` : undefined)
      parts.push(shortPlace(text(params, "location")))
      break
    }
    case "DOMAIN":
      parts.push(text(params, "companyNameOrWebsite"))
      break
    case "INFLUENCER": {
      parts.push(text(params, "description"))
      const platform = text(params, "platform")
      parts.push(platform ? PLATFORM_LABELS[platform] ?? platform : undefined)
      const from = compactNumber(params?.followersFrom)
      const to = compactNumber(params?.followersTo)
      if (from && to) parts.push(`${from}–${to} followers`)
      else if (from) parts.push(`${from}+ followers`)
      else if (to) parts.push(`up to ${to} followers`)
      break
    }
  }
  const seen = new Set<string>()
  return parts
    .filter((part): part is string => Boolean(part))
    .filter((part) => {
      const key = part.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

/** "Dentist · Tampa, FL" — or "Local search" when nothing was entered. */
export function summarizeSearch(type: SearchTypeKey, params: Params): string {
  const parts = summaryParts(type, params)
  if (parts.length === 0) return `${TYPE_LABELS[type]} search`
  return parts.map((part, i) => (i === 0 ? lead(type, part) : part)).join(" · ")
}

/** "Sep 24" in the viewer's locale-neutral short form (always English). */
export function shortDate(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/**
 * A list name made from the criteria and the date:
 * "Dentist – Tampa, FL – Sep 24". Never longer than a list name may be.
 */
export function buildAutoListName(
  type: SearchTypeKey,
  params: Params,
  now: Date = new Date()
): string {
  const date = shortDate(now)
  const parts = summaryParts(type, params).slice(0, 3)
  const head =
    parts.length > 0
      ? parts.map((part, i) => (i === 0 ? lead(type, part) : part)).join(" – ")
      : `${TYPE_LABELS[type]} search`
  const suffix = ` – ${date}`
  const room = MAX_LIST_NAME - suffix.length
  const trimmedHead = head.length > room ? `${head.slice(0, room - 1).trimEnd()}…` : head
  return `${trimmedHead}${suffix}`
}

export interface SearchCostEstimate {
  /** Most results the search can return. */
  maxResults: number
  creditsPerResult: number
  /** The worst case: every result found and charged. */
  maxCredits: number
  /** True when the worst case is more than the known balance. */
  exceedsBalance: boolean
}

/**
 * The most a search can cost. Users are charged only for results found, so
 * this is an upper bound. An unknown or infinite balance never warns.
 */
export function estimateSearchCost(
  creditsPerResult: number,
  resultsLimit: unknown,
  availableCredits?: number | null
): SearchCostEstimate {
  const limit = Number(resultsLimit)
  const maxResults = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 0
  const perResult = Number.isFinite(creditsPerResult) && creditsPerResult > 0 ? creditsPerResult : 0
  const maxCredits = maxResults * perResult
  const exceedsBalance =
    typeof availableCredits === "number" &&
    Number.isFinite(availableCredits) &&
    maxCredits > availableCredits
  return { maxResults, creditsPerResult: perResult, maxCredits, exceedsBalance }
}

/** "just now", "5 min ago", "3 hr ago", "yesterday", "4 days ago", "Sep 2". */
export function formatRelativeTime(value: string | Date, now: Date = new Date()): string {
  const date = typeof value === "string" ? new Date(value) : value
  const diffMs = now.getTime() - date.getTime()
  if (!Number.isFinite(diffMs)) return ""
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return "yesterday"
  if (days < 7) return `${days} days ago`
  return shortDate(date)
}

/** Round a requested limit up to the nearest option the form offers. */
export function snapResultsLimit(value: unknown, options: readonly number[]): number | undefined {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0 || options.length === 0) return undefined
  const sorted = [...options].sort((a, b) => a - b)
  return sorted.find((option) => option >= n) ?? sorted[sorted.length - 1]
}

/** The options each form's "Results limit" select offers. */
export const SEARCH_RESULT_LIMITS: Record<SearchTypeKey, readonly number[]> = {
  PEOPLE: [10, 25, 50, 100],
  LOCAL: [10, 25, 50],
  COMPANY: [10, 25, 50],
  DOMAIN: [10, 25, 50],
  INFLUENCER: [10, 25, 50],
}
