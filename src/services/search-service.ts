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

function getResultLimit(value: unknown, max = 50, fallback = 10): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(max, Math.max(1, Math.trunc(parsed)))
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
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
  const emailMatches = html.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || []
  const blocked = /\.(png|jpe?g|gif|webp|svg|css|js|ico|pdf)$/i

  return Array.from(new Set(emailMatches.map((email) => email.toLowerCase())))
    .filter((email) => !blocked.test(email))
    .filter((email) => !email.includes("example.com"))
    .sort((a, b) => {
      const aMatchesDomain = a.endsWith(`@${domain}`) ? 0 : 1
      const bMatchesDomain = b.endsWith(`@${domain}`) ? 0 : 1
      return aMatchesDomain - bMatchesDomain
    })
}

async function fetchPageText(url: string): Promise<string | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

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
      {
        const keyword = [params.businessType, params.description, params.location]
          .filter(Boolean)
          .join(" ")
          .trim()

        return {
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
        const niches = [
          asString(params.category),
          asString(params.description),
          ...hashtags,
        ].filter(Boolean) as string[]
        const keywords = [
          asString(params.description),
          asString(params.username),
        ].filter(Boolean) as string[]
        const minFollowers = params.minFollowers ?? params.followersFrom
        const maxFollowers = params.maxFollowers ?? params.followersTo

        return {
          platforms: params.platform ? [String(params.platform)] : ["instagram"],
          niches: niches.length ? niches : ["business"],
          hashtags: hashtags.length ? hashtags : undefined,
          keywords: keywords.length ? keywords : undefined,
          locations: params.location ? [String(params.location)] : undefined,
          followerRange: minFollowers || maxFollowers
            ? {
                min: minFollowers ? Number(minFollowers) : undefined,
                max: maxFollowers ? Number(maxFollowers) : undefined,
              }
            : undefined,
          minEngagementRate: params.engagementRate ? Number(params.engagementRate) : undefined,
          verifiedOnly: params.verified || undefined,
          businessAccountsOnly: params.accountType === "business" || params.accountType === "creator" || undefined,
          includeContactInfo: true,
          languagePreference: asString(params.language) || "en",
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
          email: typeof item.email === "string" ? item.email : null,
          phone: typeof item.phone === "string" ? item.phone : null,
          location: locationText,
          city: cityVal,
          state: stateVal,
          country: countryVal,
          linkedinUrl: typeof item.linkedinUrl === "string" ? item.linkedinUrl
            : typeof item.profileUrl === "string" ? item.profileUrl
            : typeof item.url === "string" ? item.url : null,
          companyName: typeof item.currentCompany === "string" ? item.currentCompany
            : typeof item.companyName === "string" ? item.companyName : null,
          companyWebsite: typeof item.companyWebsite === "string" ? item.companyWebsite : null,
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
          companyWebsite: item.website || item.url || null,
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
          companyWebsite: item.website || item.domain || null,
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
          engagementRate: item.engagementRate || item.engagement || null,
          bio: item.bio || item.description || null,
          avatarUrl: item.avatarUrl || item.avatar || item.profilePicture || null,
          email: item.email || item.contactEmail || null,
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
  const actorId = getActorId(type)
  const input = buildActorInput(type, params)
  const limit = getResultLimit(params.resultsLimit, type === "PEOPLE" ? 100 : 50)

  try {
    const run = await apifyClient.actor(actorId).call(input)
    const { items } = await apifyClient
      .dataset(run.defaultDatasetId)
      .listItems({ limit })

    const results = normalizeResults(type, items as Record<string, unknown>[])

    if (type === "DOMAIN" && results.length === 0) {
      return fallbackDomainContacts(params, limit)
    }

    return results
  } catch (error) {
    if (type === "DOMAIN") {
      const fallbackResults = await fallbackDomainContacts(params, limit)
      if (fallbackResults.length > 0) return fallbackResults
    }
    throw error
  }
}

export { getActorId, buildActorInput, normalizeResults }
