import { apifyClient } from "@/lib/apify"
import { SearchType } from "@/generated/prisma/enums"
import { extractEmailsFromText, extractPrimaryEmail } from "@/lib/contact-info"
import {
  findWebsiteEmails,
  normalizeWebsiteUrl,
} from "@/lib/website-email-discovery"

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
    return value
      .map((item) => asString(item))
      .filter((item): item is string => Boolean(item))
  }

  const text = asString(value)
  if (!text) return []

  return text
    .split(",")
    .map((item) => item.trim().replace(/^#/, ""))
    .filter(Boolean)
}

function normalizeDomain(value: unknown): string | undefined {
  const raw = asString(value)
  if (!raw) return undefined

  const fromEmail = raw.match(/@([a-z0-9.-]+\.[a-z]{2,})/i)?.[1]
  if (fromEmail) return fromEmail.toLowerCase()

  const withoutProtocol = raw
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split(/[/?#]/)[0]
    .trim()
    .toLowerCase()

  if (/^[a-z0-9.-]+\.[a-z]{2,}$/.test(withoutProtocol)) {
    return withoutProtocol
  }

  const slug = raw
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "")

  return slug ? `${slug}.com` : undefined
}

function companyNameFromDomain(domain: string): string {
  return domain
    .replace(/^www\./, "")
    .split(".")[0]
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function extractTitle(html: string): string | undefined {
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]
  return title?.replace(/\s+/g, " ").trim()
}

function extractEmails(html: string, domain: string): string[] {
  return extractEmailsFromText(html, domain)
}

function getCurrentPosition(item: Record<string, unknown>): Record<string, unknown> | null {
  const positions = item.currentPosition
  if (!Array.isArray(positions) || !positions.length) return null

  const first = positions[0]
  return first && typeof first === "object" ? first as Record<string, unknown> : null
}

function getNestedRecord(
  value: unknown,
  key: string
): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null
  const nested = (value as Record<string, unknown>)[key]
  return nested && typeof nested === "object" ? nested as Record<string, unknown> : null
}

function getCompanyNameFromProfile(item: Record<string, unknown>): string | null {
  const currentPosition = getCurrentPosition(item)
  const currentCompany = getNestedRecord(currentPosition, "company")

  return (
    asString(item.currentCompany) ||
    asString(item.companyName) ||
    asString(currentPosition?.companyName) ||
    asString(currentCompany?.name) ||
    null
  )
}

function getCompanyWebsiteFromProfile(item: Record<string, unknown>): string | null {
  const currentPosition = getCurrentPosition(item)
  const currentCompany = getNestedRecord(currentPosition, "company")

  return (
    asString(item.companyWebsite) ||
    asString(currentCompany?.website) ||
    null
  )
}

function getCompanyLinkedInFromProfile(item: Record<string, unknown>): string | null {
  const currentPosition = getCurrentPosition(item)
  const currentCompany = getNestedRecord(currentPosition, "company")

  return (
    asString(item.companyLinkedin) ||
    asString(item.companyLinkedIn) ||
    asString(currentPosition?.companyLinkedinUrl) ||
    asString(currentCompany?.linkedinUrl) ||
    null
  )
}

async function fetchPageText(url: string, timeoutMs = 6000): Promise<string | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "PipeLeadFinder/1.0 (contact@scale.gg)",
        Accept: "text/html,application/xhtml+xml",
      },
    })

    if (!res.ok) return null
    const contentType = res.headers.get("content-type") || ""
    if (!contentType.includes("text/html")) return null

    return await res.text()
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

async function enrichWebsiteEmails(
  type: SearchType,
  leads: Array<Record<string, unknown>>
): Promise<Array<Record<string, unknown>>> {
  if (type !== "LOCAL" && type !== "COMPANY") return leads

  const enriched: Array<Record<string, unknown>> = []
  const batchSize = 5

  for (let index = 0; index < leads.length; index += batchSize) {
    const batch = leads.slice(index, index + batchSize)
    const results = await Promise.all(
      batch.map(async (lead) => {
        if (lead.email) return lead

        const emails = await findWebsiteEmails(lead.companyWebsite, 1)
        if (!emails.length) return lead

        return {
          ...lead,
          email: emails[0],
          rawData: {
            ...(typeof lead.rawData === "object" && lead.rawData ? lead.rawData : {}),
            websiteEmailSource: {
              website: lead.companyWebsite,
              email: emails[0],
            },
          },
        }
      })
    )
    enriched.push(...results)
  }

  return enriched
}

async function fallbackDomainContacts(
  params: Record<string, unknown>,
  limit: number
): Promise<Array<Record<string, unknown>>> {
  const domain = normalizeDomain(params.domain ?? params.companyNameOrWebsite)
  if (!domain) return []

  const paths = ["", "/contact", "/contact-us", "/about", "/about-us", "/team"]
  const emails = new Set<string>()
  let title: string | undefined

  for (const path of paths) {
    if (emails.size >= limit) break
    const html =
      (await fetchPageText(`https://${domain}${path}`)) ||
      (path === "" ? await fetchPageText(`http://${domain}${path}`) : null)

    if (!html) continue
    title ||= extractTitle(html)
    for (const email of extractEmails(html, domain)) {
      emails.add(email)
      if (emails.size >= limit) break
    }
  }

  const companyName = title || companyNameFromDomain(domain)
  return Array.from(emails).slice(0, limit).map((email) => ({
    sourceType: "DOMAIN",
    rawData: {
      source: "domain-contact-fallback",
      domain,
      email,
    },
    fullName: email
      .split("@")[0]
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase()),
    email,
    companyName,
    companyWebsite: `https://${domain}`,
  }))
}

function domainSearchQuery(params: Record<string, unknown>): string | undefined {
  const raw = asString(params.companyNameOrWebsite) || asString(params.domain)
  const domain = normalizeDomain(raw)

  return raw || (domain ? companyNameFromDomain(domain) : undefined)
}

async function findLinkedInCompanyForDomain(
  params: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  const actorId = process.env.APIFY_ACTOR_COMPANY
  const query = domainSearchQuery(params)
  if (!actorId || !query) return null

  const run = await apifyClient.actor(actorId).call({
    keyword: query,
    page_number: 1,
    limit: 5,
  })
  const { items } = await apifyClient
    .dataset(run.defaultDatasetId)
    .listItems({ limit: 5 })

  const domain = normalizeDomain(params.companyNameOrWebsite ?? params.domain)
  const slug = domain ? domain.split(".")[0] : query.toLowerCase()

  const companies = items as Record<string, unknown>[]
  return (
    companies.find((item) => {
      const name = asString(item.name)?.toLowerCase() || ""
      const url = asString(item.company_url)?.toLowerCase() || ""
      return Boolean(asString(item.company_url)) && (name.includes(slug) || url.includes(slug))
    }) ||
    companies.find((item) => Boolean(asString(item.company_url))) ||
    null
  )
}

async function executeDomainPeopleSearch(
  params: Record<string, unknown>,
  limit: number
): Promise<Array<Record<string, unknown>>> {
  const peopleActorId = process.env.APIFY_ACTOR_PEOPLE
  if (!peopleActorId) {
    throw new Error("APIFY_ACTOR_PEOPLE is not configured")
  }

  const query = domainSearchQuery(params)
  if (!query) return []

  const company = await findLinkedInCompanyForDomain(params)
  const companyLinkedinUrl = asString(company?.company_url)
  const companyName = asString(company?.name) || query
  const companyWebsite = normalizeDomain(params.companyNameOrWebsite ?? params.domain)

  const input: Record<string, unknown> = {
    searchQuery: companyName,
    maxItems: limit,
    profileScraperMode: "Full + email search",
  }

  if (companyLinkedinUrl) {
    input.currentCompanies = [companyLinkedinUrl]
  }

  const run = await apifyClient.actor(peopleActorId).call(input)
  const { items } = await apifyClient
    .dataset(run.defaultDatasetId)
    .listItems({ limit })

  const results = normalizeResults("PEOPLE", items as Record<string, unknown>[])
  return results.map((lead) => ({
    ...lead,
    rawData: {
      ...(typeof lead.rawData === "object" && lead.rawData ? lead.rawData : {}),
      domainSearch: {
        input: params.companyNameOrWebsite ?? params.domain,
        companyName,
        companyLinkedinUrl,
      },
    },
    companyName: lead.companyName || companyName,
    companyWebsite: lead.companyWebsite || (companyWebsite ? `https://${companyWebsite}` : undefined),
    companyLinkedin: lead.companyLinkedin || companyLinkedinUrl,
  }))
}

function influencerQuery(params: Record<string, unknown>): string | undefined {
  const hashtags = cleanArray(params.hashtags)
  const parts = [
    asString(params.description),
    asString(params.category),
    ...hashtags,
    asString(params.location),
  ].filter(Boolean)

  return parts.length ? parts.join(" ") : undefined
}

async function executeYouTubeInfluencerSearch(
  params: Record<string, unknown>,
  limit: number
): Promise<Array<Record<string, unknown>>> {
  const actorId = process.env.APIFY_ACTOR_YOUTUBE || "streamers/youtube-scraper"
  const query = influencerQuery(params)
  if (!query) return []

  const run = await apifyClient.actor(actorId).call({
    searchQueries: [query],
    maxResults: limit,
    maxResultsShorts: 0,
    maxResultStreams: 0,
  })
  const { items } = await apifyClient
    .dataset(run.defaultDatasetId)
    .listItems({ limit: Math.max(limit * 2, 10) })

  const seen = new Set<string>()
  const leads: Array<Record<string, unknown>> = []

  for (const item of items as Record<string, unknown>[]) {
    const channelUrl = asString(item.channelUrl) || asString(item.channelURL)
    const channelId = asString(item.channelId)
    const channelName = asString(item.channelName) || asString(item.channelTitle)
    const key = channelUrl || channelId || channelName
    if (!key || seen.has(key)) continue
    seen.add(key)

    const viewCount = asNumber(item.viewCount)
    const likes = asNumber(item.likes)
    const engagementRate = viewCount && likes ? Number(((likes / viewCount) * 100).toFixed(2)) : null

    leads.push({
      sourceType: "INFLUENCER",
      rawData: item,
      fullName: channelName || asString(item.title) || null,
      username: asString(item.channelUsername)?.replace(/^@/, "") || null,
      platform: "youtube",
      followerCount: asInt(item.numberOfSubscribers),
      engagementRate,
      bio: asString(item.text) || asString(item.title) || null,
      avatarUrl: asString(item.channelAvatarUrl) || asString(item.thumbnailUrl) || null,
      email: extractPrimaryEmail(item),
      location: asString(item.location) || asString(params.location) || null,
      youtubeUrl: channelUrl || null,
    })

    if (leads.length >= limit) break
  }

  return leads
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
        maxItems: getResultLimit(params.resultsLimit, 100),
        profileScraperMode: "Full + email search",
        // Advanced filters
        seniorityLevelIds: params.managementLevel ? [String(params.managementLevel)] : undefined,
        industryIds: params.industry ? [String(params.industry)] : undefined,
        recentlyChangedJobs: params.changedJobsWithin ? true : undefined,
        schools: params.school ? [String(params.school)] : undefined,
        companyHeadcount: params.employeeCount ? [String(params.employeeCount)] : undefined,
      }

    case "LOCAL":
      // Google Maps Search actor
      {
        const keyword = [params.businessType, params.description, params.location]
          .filter(Boolean)
          .join(" ")
          .trim()

        return {
          keywords: keyword || undefined,
          searchTerms: keyword ? [keyword] : [],
          maxItems: getResultLimit(params.resultsLimit),
          language: "en",
          country: "US",
        }
      }

    case "COMPANY":
      // LinkedIn Companies Search Scraper actor
      {
        const keyword = [
          params.keyword,
          params.description,
          params.companyName,
          params.domain,
          params.industry,
          params.technologies,
          params.location,
        ]
          .map(asString)
          .filter(Boolean)
          .join(" ")
          .trim()

        return {
          keyword: keyword || "company",
          page_number: 1,
          limit: getResultLimit(params.resultsLimit),
          company_sizes: params.employeeCount ? [String(params.employeeCount)] : undefined,
        }
      }

    case "DOMAIN":
      // Company Enrichment API actor
      {
        const domain = normalizeDomain(params.domain ?? params.companyNameOrWebsite)

        return {
          domain,
          domains: domain ? [domain] : undefined,
          brief: false,
        }
      }

    case "INFLUENCER":
      // Influencer Discovery actor
      {
        const hashtags = cleanArray(params.hashtags)
        const description = asString(params.description)
        const location = asString(params.location)
        const minFollowers = asNumber(params.minFollowers ?? params.followersFrom)
        const maxFollowers = asNumber(params.maxFollowers ?? params.followersTo)
        const minEngagementRate = asNumber(params.engagementRate)
        const queryText = [description, location].filter(Boolean).join(" ").trim()
        const niches = [
          asString(params.category),
          description,
          ...hashtags,
        ].filter(Boolean) as string[]
        const keywords = [
          description,
          asString(params.username),
          ...hashtags,
        ].filter(Boolean) as string[]

        return {
          platforms: params.platform ? [String(params.platform)] : ["instagram"],
          niches,
          hashtags: hashtags.length ? hashtags : undefined,
          keywords: keywords.length ? keywords : undefined,
          searchQueries: queryText ? [queryText] : undefined,
          locations: location ? [location] : undefined,
          influencerTiers: ["nano", "micro", "mid", "macro", "mega"],
          followerRange: minFollowers !== undefined || maxFollowers !== undefined
            ? {
                min: minFollowers,
                max: maxFollowers,
              }
            : undefined,
          minEngagementRate,
          verifiedOnly: params.verified === true ? true : undefined,
          businessAccountsOnly: params.accountType === "business" ? true : undefined,
          includeContactInfo: true,
          languagePreference: asString(params.language),
          maxResults: getResultLimit(params.resultsLimit, 50, 10),
          demoMode: false,
        }
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
  const normalized: Array<Record<string, unknown>> = []

  for (const item of items) {
    const base: Record<string, unknown> = {
      sourceType: type,
      rawData: item,
    }

    switch (type) {
      case "PEOPLE": {
        // HarvestAPI LinkedIn output — location is a nested object
        const loc = item.location as Record<string, unknown> | string | null | undefined
        const locParsed = (typeof loc === "object" && loc !== null)
          ? loc.parsed as Record<string, unknown> | undefined
          : undefined
        const locationText = typeof loc === "string"
          ? loc
          : (typeof loc === "object" && loc !== null)
            ? (loc.linkedinText as string) || (locParsed?.text as string) || null
            : null
        const cityVal = (locParsed?.city as string) || null
        const stateVal = (locParsed?.state as string) || null
        const countryVal = (locParsed?.country as string) || (locParsed?.countryFull as string) || null

        normalized.push({
          ...base,
          fullName: item.fullName || item.name || `${item.firstName || ""} ${item.lastName || ""}`.trim() || null,
          firstName: typeof item.firstName === "string" ? item.firstName : null,
          lastName: typeof item.lastName === "string" ? item.lastName : null,
          title: typeof item.headline === "string" ? item.headline : typeof item.title === "string" ? item.title : null,
          headline: typeof item.headline === "string" ? item.headline : null,
          email: extractPrimaryEmail(item),
          phone: typeof item.phone === "string" ? item.phone : null,
          location: locationText,
          city: cityVal,
          state: stateVal,
          country: countryVal,
          linkedinUrl: typeof item.linkedinUrl === "string" ? item.linkedinUrl
            : typeof item.profileUrl === "string" ? item.profileUrl
            : typeof item.url === "string" ? item.url : null,
          companyName: getCompanyNameFromProfile(item),
          companyWebsite: getCompanyWebsiteFromProfile(item),
          companyLinkedin: getCompanyLinkedInFromProfile(item),
          avatarUrl: typeof item.profilePicture === "string" ? item.profilePicture
            : typeof item.avatarUrl === "string" ? item.avatarUrl : null,
        })
        break
      }

      case "LOCAL":
        // Google Maps output
        normalized.push({
          ...base,
          fullName: item.name || item.title || null,
          companyName: item.name || item.title || null,
          phone: item.phone || item.phoneNumber || null,
          email: extractPrimaryEmail(item, normalizeDomain(item.website)),
          companyWebsite: normalizeWebsiteUrl(item.website) || null,
          location: item.address || null,
          city: item.district || item.city || null,
          state: item.state || null,
          country: item.country || null,
          companyIndustry: item.categoryName || (Array.isArray(item.categories) ? (item.categories as string[])[0] : item.categories || null),
        })
        break

      case "COMPANY":
        // LinkedIn Company output
        normalized.push({
          ...base,
          fullName: item.name || item.companyName || null,
          companyName: item.name || item.companyName || null,
          email: extractPrimaryEmail(item, normalizeDomain(item.website ?? item.domain)),
          companyWebsite: normalizeWebsiteUrl(item.website || item.domain) || null,
          companyLinkedin: item.linkedinUrl || item.company_url || item.url || null,
          companySize: item.employeeCount || item.size || item.staffCount || null,
          companyIndustry: item.industry || null,
          companyRevenue: item.revenue || null,
          location: item.location || item.headquarters || null,
          avatarUrl: item.logo_url || item.logoUrl || null,
          bio: item.description || null,
        })
        break

      case "DOMAIN": {
        // Company Enrichment output
        if (item.mocked === true) break

        const domain = asString(item.domain) || asString(item.website)
        const contact = item.contact as Record<string, unknown> | undefined
        const socialProfiles = item.social_profiles as Record<string, unknown> | undefined
        const emails = cleanArray(contact?.emails)
        const companyName = item.name || item.companyName || item.company_name || (domain ? companyNameFromDomain(domain) : null)
        const companyWebsite = domain ? `https://${domain}` : item.website || null
        const linkedInProfile = socialProfiles?.linkedin as Record<string, unknown> | undefined

        if (emails.length > 0) {
          for (const email of emails) {
            normalized.push({
              ...base,
              fullName: email
                .split("@")[0]
                .replace(/[._-]+/g, " ")
                .replace(/\b\w/g, (char) => char.toUpperCase()),
              email,
              companyName,
              companyWebsite,
              companyLinkedin: linkedInProfile?.url || item.linkedinUrl || null,
              companySize: item.employeeCount || item.size || null,
              companyIndustry: item.industry || null,
              companyRevenue: item.revenue || null,
              location: item.location || item.headquarters || null,
              country: item.country || null,
            })
          }
          break
        }

        if (companyName || companyWebsite) {
          normalized.push({
            ...base,
            fullName: companyName || null,
            companyName,
            companyWebsite,
            companyLinkedin: linkedInProfile?.url || item.linkedinUrl || null,
            companySize: item.employeeCount || item.size || null,
            companyIndustry: item.industry || null,
            companyRevenue: item.revenue || null,
            location: item.location || item.headquarters || null,
            country: item.country || null,
          })
        }
        break
      }

      case "INFLUENCER":
        // Influencer Discovery output
        {
          const platform = item.platform || null
          const profileUrl = item.profileUrl || item.url || null

          normalized.push({
          ...base,
          fullName: item.displayName || item.name || item.fullName || item.username || null,
          username: item.username || item.handle || null,
          platform,
          followerCount: item.followerCount || item.followers || null,
          engagementRate: asNumber(item.engagementRate) ?? asNumber(item.engagement) ?? null,
          bio: item.bio || item.description || null,
          avatarUrl: item.avatarUrl || item.avatar || item.profilePicture || null,
          email: extractPrimaryEmail(item),
          location: item.location || null,
          instagramUrl: platform === "instagram" ? profileUrl : null,
          tiktokUrl: platform === "tiktok" ? profileUrl : null,
          youtubeUrl: platform === "youtube" ? profileUrl : null,
          twitterUrl: platform === "twitter" ? profileUrl : null,
        })
        }
        break

      default:
        normalized.push({
          ...base,
          fullName: item.name || item.fullName || null,
          email: item.email || null,
          phone: item.phone || null,
          location: item.location || null,
        })
        break
    }
  }

  return normalized
}

// Main search execution function
export async function executeSearch(
  type: SearchType,
  params: Record<string, unknown>
) {
  const limit = getResultLimit(params.resultsLimit, type === "PEOPLE" ? 100 : 50)

  if (type === "DOMAIN") {
    const results = await executeDomainPeopleSearch(params, limit)
    if (results.length > 0) return results

    return fallbackDomainContacts(params, limit)
  }

  if (type === "INFLUENCER" && params.platform === "youtube") {
    const results = await executeYouTubeInfluencerSearch(params, limit)
    if (results.length > 0) return results
  }

  const actorId = getActorId(type)
  const input = buildActorInput(type, params)

  try {
    const run = await apifyClient.actor(actorId).call(input)
    const { items } = await apifyClient
      .dataset(run.defaultDatasetId)
      .listItems({ limit })

    const results = normalizeResults(type, items as Record<string, unknown>[])
    return enrichWebsiteEmails(type, results)
  } catch (error) {
    throw error
  }
}

export { getActorId, buildActorInput, normalizeResults }
