import { apifyClient } from "@/lib/apify"
import { SearchType } from "@/generated/prisma/enums"

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
function buildActorInput(
  type: SearchType,
  params: Record<string, unknown>
): Record<string, unknown> {
  switch (type) {
    case "PEOPLE":
      // HarvestAPI LinkedIn Profile Search actor
      return {
        searchQuery: params.description || undefined,
        locations: params.location ? [String(params.location)] : undefined,
        currentJobTitles: params.jobTitle ? [String(params.jobTitle)] : undefined,
        maxItems: Number(params.resultsLimit) || 10,
        profileScraperMode: "Full",
        // Advanced filters
        seniorityLevelIds: params.managementLevel ? [String(params.managementLevel)] : undefined,
        industryIds: params.industry ? [String(params.industry)] : undefined,
        recentlyChangedJobs: params.changedJobsWithin ? true : undefined,
        schools: params.school ? [String(params.school)] : undefined,
        companyHeadcount: params.employeeCount ? [String(params.employeeCount)] : undefined,
      }

    case "LOCAL":
      // Google Maps Search actor
      return {
        keywords: `${params.description || ""} ${params.location || ""}`.trim(),
        maxItems: Number(params.resultsLimit) || 10,
      }

    case "COMPANY":
      // LinkedIn Companies Search Scraper actor
      return {
        keyword: params.description || params.companyName || undefined,
        location: params.location || undefined,
        maxResults: Number(params.resultsLimit) || 10,
      }

    case "DOMAIN":
      // Company Enrichment API actor
      return {
        domains: params.domain ? [String(params.domain)] : undefined,
        domain: params.domain || undefined,
      }

    case "INFLUENCER":
      // Influencer Discovery actor
      return {
        keyword: params.description || params.niche || undefined,
        platform: params.platform || undefined,
        minFollowers: params.minFollowers ? Number(params.minFollowers) : undefined,
        maxFollowers: params.maxFollowers ? Number(params.maxFollowers) : undefined,
        maxItems: Number(params.resultsLimit) || 10,
      }

    default:
      return params
  }
}

// Normalize raw Apify output into our Lead model shape
function normalizeResults(
  type: SearchType,
  items: Record<string, unknown>[]
): Array<Record<string, unknown>> {
  return items.map((item) => {
    const base: Record<string, unknown> = {
      sourceType: type,
      rawData: item,
    }

    switch (type) {
      case "PEOPLE":
        // HarvestAPI LinkedIn output
        return {
          ...base,
          fullName: item.fullName || item.name || `${item.firstName || ""} ${item.lastName || ""}`.trim() || null,
          firstName: item.firstName || null,
          lastName: item.lastName || null,
          title: item.headline || item.title || item.currentTitle || null,
          headline: item.headline || null,
          email: item.email || null,
          phone: item.phone || null,
          location: item.location || item.geoLocation || null,
          city: item.city || null,
          state: item.state || null,
          country: item.country || null,
          linkedinUrl: item.profileUrl || item.linkedinUrl || item.url || null,
          companyName: item.currentCompany || item.companyName || null,
          companyWebsite: item.companyWebsite || null,
          avatarUrl: item.profilePicture || item.avatarUrl || item.photo || null,
        }

      case "LOCAL":
        // Google Maps output
        return {
          ...base,
          fullName: item.name || item.title || null,
          companyName: item.name || item.title || null,
          phone: item.phone || item.phoneNumber || null,
          companyWebsite: item.website || item.url || null,
          location: item.address || null,
          city: item.city || null,
          state: item.state || null,
          country: item.country || null,
          companyIndustry: Array.isArray(item.categories) ? (item.categories as string[])[0] : item.categories || null,
        }

      case "COMPANY":
        // LinkedIn Company output
        return {
          ...base,
          fullName: item.name || item.companyName || null,
          companyName: item.name || item.companyName || null,
          companyWebsite: item.website || item.domain || null,
          companyLinkedin: item.linkedinUrl || item.url || null,
          companySize: item.employeeCount || item.size || item.staffCount || null,
          companyIndustry: item.industry || null,
          companyRevenue: item.revenue || null,
          location: item.location || item.headquarters || null,
        }

      case "DOMAIN":
        // Company Enrichment output
        return {
          ...base,
          fullName: item.name || item.companyName || null,
          companyName: item.name || item.companyName || null,
          companyWebsite: item.domain || item.website || null,
          companyLinkedin: item.linkedinUrl || null,
          companySize: item.employeeCount || item.size || null,
          companyIndustry: item.industry || null,
          companyRevenue: item.revenue || null,
          location: item.location || item.headquarters || null,
          country: item.country || null,
        }

      case "INFLUENCER":
        // Influencer Discovery output
        return {
          ...base,
          fullName: item.name || item.fullName || item.username || null,
          username: item.username || item.handle || null,
          platform: item.platform || null,
          followerCount: item.followerCount || item.followers || null,
          engagementRate: item.engagementRate || item.engagement || null,
          bio: item.bio || item.description || null,
          avatarUrl: item.avatarUrl || item.avatar || item.profilePicture || null,
          email: item.email || null,
          location: item.location || null,
        }

      default:
        return {
          ...base,
          fullName: item.name || item.fullName || null,
          email: item.email || null,
          phone: item.phone || null,
          location: item.location || null,
        }
    }
  })
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
