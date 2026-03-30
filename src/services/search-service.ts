import { apifyClient } from "@/lib/apify"
import { SearchType } from "@/generated/prisma"

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

// Transform search form params into Apify actor input format
// This will be customized per actor once we know their input schemas
function buildActorInput(
  type: SearchType,
  params: Record<string, unknown>
): Record<string, unknown> {
  // For now, pass params through — each actor will need specific input mapping
  return params
}

// Normalize raw Apify output into our Lead model shape
function normalizeResults(
  type: SearchType,
  items: Record<string, unknown>[]
): Array<Record<string, unknown>> {
  // Base normalization — map common fields
  return items.map((item) => ({
    sourceType: type,
    rawData: item,
    // These will be populated based on actual Apify actor output schemas
    fullName: item.name || item.fullName || item.full_name || null,
    firstName: item.firstName || item.first_name || null,
    lastName: item.lastName || item.last_name || null,
    title: item.title || item.jobTitle || item.job_title || null,
    email: item.email || item.emailAddress || null,
    phone: item.phone || item.phoneNumber || null,
    location: item.location || item.city || null,
    city: item.city || null,
    state: item.state || null,
    country: item.country || null,
    linkedinUrl: item.linkedinUrl || item.linkedin || null,
    companyName:
      item.companyName || item.company || item.organization || null,
    companyWebsite: item.companyWebsite || item.website || item.domain || null,
    // Influencer fields
    platform: type === "INFLUENCER" ? item.platform || null : null,
    username: item.username || item.handle || null,
    followerCount: item.followerCount || item.followers || null,
    engagementRate: item.engagementRate || null,
    bio: item.bio || item.description || null,
    avatarUrl:
      item.avatarUrl || item.avatar || item.profilePicture || null,
  }))
}

// Main search execution function
export async function executeSearch(
  type: SearchType,
  params: Record<string, unknown>
) {
  const actorId = getActorId(type)
  const input = buildActorInput(type, params)

  const run = await apifyClient.actor(actorId).call(input)
  const { items } = await apifyClient
    .dataset(run.defaultDatasetId)
    .listItems()

  return normalizeResults(type, items as Record<string, unknown>[])
}

export { getActorId, buildActorInput, normalizeResults }
