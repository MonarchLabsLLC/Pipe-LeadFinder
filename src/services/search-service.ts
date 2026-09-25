import { apifyClient } from "@/lib/apify"
import { SearchType } from "@/generated/prisma/enums"
import { extractEmailsFromText, extractPrimaryEmail } from "@/lib/contact-info"
import {
  findWebsiteEmails,
  normalizeWebsiteUrl,
} from "@/lib/website-email-discovery"
import { readLimitedText, safeFetch } from "@/lib/safe-url"
import { resolveTikTokPlace } from "@/lib/tiktok-place"

// Map search type to Apify actor ID from env vars
function getActorId(type: SearchType): string {
  const actors: Record<SearchType, string | undefined> = {
    PEOPLE: process.env.APIFY_ACTOR_PEOPLE,
    LOCAL: process.env.APIFY_ACTOR_LOCAL,
    COMPANY: process.env.APIFY_ACTOR_COMPANY,
    DOMAIN: process.env.APIFY_ACTOR_DOMAIN,
    INFLUENCER: process.env.APIFY_ACTOR_INFLUENCER,
  }
  const actorId = actors[type]
  if (!actorId)
    throw new Error(`No Apify actor configured for search type: ${type}`)
  return actorId
}

export function assertSearchConfigured(
  type: SearchType,
  params: Record<string, unknown> = {}
) {
  void params
  if (type === "DOMAIN") {
    if (!process.env.APIFY_ACTOR_COMPANY || !process.env.APIFY_ACTOR_PEOPLE) {
      throw new Error(
        "Domain search requires APIFY_ACTOR_COMPANY and APIFY_ACTOR_PEOPLE"
      )
    }
    return
  }

  if (type === "INFLUENCER") return
  getActorId(type)
}

function getResultLimit(value: unknown, max = 50, fallback = 10): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(max, Math.max(1, Math.trunc(parsed)))
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function asNumber(value: unknown): number | undefined {
  if (value === "" || value === null || value === undefined) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function asInt(value: unknown): number | null {
  const parsed = asNumber(value)
  return parsed === undefined ? null : Math.trunc(parsed)
}

function cleanArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => asString(item)).filter((item): item is string => Boolean(item))
  }
  const text = asString(value)
  if (!text) return []
  return text.split(",").map((item) => item.trim().replace(/^#/, "")).filter(Boolean)
}

function influencerFollowerBounds(params: Record<string, unknown>) {
  return {
    min: asNumber(params.minFollowers ?? params.followersFrom),
    max: asNumber(params.maxFollowers ?? params.followersTo),
  }
}

export function buildTikTokInfluencerInput(params: Record<string, unknown>) {
  const hashtags = cleanArray(params.hashtags)
  const niche = [asString(params.description), asString(params.category)].filter(Boolean).join(" ")
  const location = asString(params.location)
  const place = resolveTikTokPlace(location)
  const query = [niche, place.keywordHint].filter(Boolean).join(" ") || (hashtags.length ? hashtags.join(" ") : "")
  if (!query) throw new Error("Influencer search requires a niche or description")
  const { min, max } = influencerFollowerBounds(params)
  const minimumEngagement = asNumber(params.engagementRate)
  const language = asString(params.language)
  return {
    keywords: [query],
    hashtags: hashtags.length ? hashtags : undefined,
    maxCreators: getResultLimit(params.resultsLimit, 50, 10),
    minFollowers: min,
    maxFollowers: max,
    verifiedOnly: params.verified === true ? true : undefined,
    languages: language && language !== "any" ? [language] : undefined,
    countryCodes: place.countryCode ? [place.countryCode] : undefined,
    countryMatchMode: place.countryCode ? "best_effort" : undefined,
    region: place.region,
    enrichBio: true,
    followBioLinks: true,
    includePerformance: minimumEngagement !== undefined,
    campaignBrief: location ? `${niche || query} in ${location}` : query,
    sortBy: "qualificationScore",
  }
}
