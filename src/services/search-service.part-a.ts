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
