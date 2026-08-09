import { apifyClient } from "@/lib/apify"
import { SearchType } from "@/generated/prisma/enums"
import { extractEmailsFromText, extractPrimaryEmail } from "@/lib/contact-info"
import {
  findWebsiteEmails,
  normalizeWebsiteUrl,
} from "@/lib/website-email-discovery"
import { readLimitedText, safeFetch } from "@/lib/safe-url"

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

  // Influencer discovery is routed to a dedicated, platform-specific actor.
  // Keep the legacy APIFY_ACTOR_INFLUENCER setting available for existing
  // deployments, but do not require it for new searches.
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

const PEOPLE_SENIORITY_IDS: Record<string, string> = {
  entry: "110",
  senior: "120",
  manager: "210",
  director: "220",
  vp: "300",
  "c-level": "310",
  owner: "320",
}

const PEOPLE_EXPERIENCE_IDS: Record<string, string> = {
  "0-1": "1",
  "1-3": "2",
  "3-5": "3",
  "5-10": "4",
  "10+": "5",
}

const PEOPLE_HEADCOUNT_IDS: Record<string, string> = {
  "1-10": "B",
  "11-50": "C",
  "51-200": "D",
  "201-500": "E",
  "501-1000": "F",
  "1001-5000": "G",
  "5001-10000": "H",
  "10001+": "I",
}

const PEOPLE_FUNCTION_IDS: Record<string, string> = {
  accounting: "1",
  administrative: "2",
  design: "3",
  "business development": "4",
  consulting: "6",
  education: "7",
  engineering: "8",
  finance: "10",
  healthcare: "11",
  "human resources": "12",
  hr: "12",
  "information technology": "13",
  it: "13",
  legal: "14",
  marketing: "15",
  operations: "18",
  product: "19",
  purchasing: "21",
  "real estate": "23",
  research: "24",
  sales: "25",
  "customer success": "26",
}

const COMPANY_SIZE_VALUES: Record<string, string> = {
  "1-10": "1-10 employees",
  "11-50": "11-50 employees",
  "51-200": "51-200 employees",
  "201-500": "201-500 employees",
  "501-1000": "501-1000 employees",
  "1001-5000": "1001-5000 employees",
  "5001-10000": "5001-10,000 employees",
  "10001+": "10,001+ employees",
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
    (Array.isArray(item.companyWebsites)
      ? asString(item.companyWebsites[0])
      : undefined) ||
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
  try {
    const res = await safeFetch(url, {
      headers: {
        "User-Agent": "PipeLeadFinder/1.0 (contact@scale.gg)",
        Accept: "text/html,application/xhtml+xml",
      },
    }, { timeoutMs, maxRedirects: 3 })

    if (!res.ok) return null
    const contentType = res.headers.get("content-type") || ""
    if (!contentType.includes("text/html")) return null

    return await readLimitedText(res)
  } catch {
    return null
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

const INSTAGRAM_INFLUENCER_ACTOR = "apify/instagram-search-scraper"
const TIKTOK_INFLUENCER_ACTOR = "coregent/tiktok-influencer-finder"

function influencerFollowerBounds(params: Record<string, unknown>) {
  return {
    min: asNumber(params.minFollowers ?? params.followersFrom),
    max: asNumber(params.maxFollowers ?? params.followersTo),
  }
}

function influencerEngagementRate(item: Record<string, unknown>): number | null {
  const direct = asNumber(item.engagementRate) ?? asNumber(item.estimatedEngagementRate)
  if (direct !== undefined) return direct <= 1 ? Number((direct * 100).toFixed(2)) : direct

  const followers = asNumber(item.followersCount) ?? asNumber(item.followerCount)
  const posts = item.latestPosts
  if (!followers || !Array.isArray(posts) || posts.length === 0) return null

  const interactions = posts.map((post) => {
    if (!post || typeof post !== "object") return 0
    const record = post as Record<string, unknown>
    return (asNumber(record.likesCount) ?? asNumber(record.likeCount) ?? 0) +
      (asNumber(record.commentsCount) ?? asNumber(record.commentCount) ?? 0)
  })
  const average = interactions.reduce((total, value) => total + value, 0) / interactions.length
  return Number(((average / followers) * 100).toFixed(2))
}

export function buildInstagramInfluencerInput(params: Record<string, unknown>) {
  const query = influencerQuery(params)
  if (!query) throw new Error("Influencer search requires a niche or description")

  return {
    search: query,
    searchType: "user",
    searchLimit: getResultLimit(params.resultsLimit, 50, 10),
  }
}

export function buildTikTokInfluencerInput(params: Record<string, unknown>) {
  const hashtags = cleanArray(params.hashtags)
  const query = influencerQuery(params)
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
    enrichBio: true,
    includePerformance: minimumEngagement !== undefined,
    campaignBrief: query,
    sortBy: "qualificationScore",
  }
}

function normalizeInstagramInfluencer(
  item: Record<string, unknown>,
  params: Record<string, unknown>
): Record<string, unknown> | null {
  const username = asString(item.username)
  const profileUrl = asString(item.url) || asString(item.profileUrl)
  if (!username && !profileUrl) return null

  const { min, max } = influencerFollowerBounds(params)
  const followerCount = asNumber(item.followersCount) ?? asNumber(item.followerCount)
  const verified = item.verified === true || item.isVerified === true
  const accountType = asString(params.accountType)
  const isBusiness = item.isBusinessAccount === true
  const engagementRate = influencerEngagementRate(item)
  const minimumEngagement = asNumber(params.engagementRate)

  if ((min !== undefined && (followerCount === undefined || followerCount < min)) ||
      (max !== undefined && (followerCount === undefined || followerCount > max)) ||
      (params.verified === true && !verified) ||
      (accountType && accountType !== "any" && !isBusiness) ||
      (minimumEngagement !== undefined && engagementRate !== null && engagementRate < minimumEngagement)) {
    return null
  }

  return {
    sourceType: "INFLUENCER",
    rawData: item,
    fullName: asString(item.fullName) || asString(item.displayName) || username || null,
    username: username || null,
    platform: "instagram",
    followerCount: followerCount ?? null,
    engagementRate,
    bio: asString(item.biography) || asString(item.bio) || null,
    avatarUrl: asString(item.profilePicUrl) || asString(item.profilePictureUrl) || null,
    email: extractPrimaryEmail(item),
    location: asString(params.location) || null,
    instagramUrl: profileUrl || (username ? `https://www.instagram.com/${username}` : null),
  }
}

function normalizeTikTokInfluencer(
  item: Record<string, unknown>,
  params: Record<string, unknown>
): Record<string, unknown> | null {
  const username = asString(item.username)
  const profileUrl = asString(item.profileUrl) || asString(item.url)
  if (!username && !profileUrl) return null

  const { min, max } = influencerFollowerBounds(params)
  const followerCount = asNumber(item.followersCount) ?? asNumber(item.followerCount)
  const engagementRate = influencerEngagementRate(item)
  const minimumEngagement = asNumber(params.engagementRate)

  if ((min !== undefined && (followerCount === undefined || followerCount < min)) ||
      (max !== undefined && (followerCount === undefined || followerCount > max)) ||
      (params.verified === true && item.isVerified !== true && item.verified !== true) ||
      (minimumEngagement !== undefined && engagementRate !== null && engagementRate < minimumEngagement)) {
    return null
  }

  return {
    sourceType: "INFLUENCER",
    rawData: item,
    fullName: asString(item.displayName) || asString(item.fullName) || username || null,
    username: username || null,
    platform: "tiktok",
    followerCount: followerCount ?? null,
    engagementRate,
    bio: asString(item.bio) || null,
    avatarUrl: asString(item.profilePictureUrl) || asString(item.avatarUrl) || null,
    email: extractPrimaryEmail(item),
    location: asString(item.country) || asString(params.location) || null,
    tiktokUrl: profileUrl || (username ? `https://www.tiktok.com/@${username.replace(/^@/, "")}` : null),
    instagramUrl: asString(item.instagramUrl) || null,
    youtubeUrl: asString(item.youtubeUrl) || null,
  }
}

async function executeInstagramInfluencerSearch(
  params: Record<string, unknown>,
  limit: number
): Promise<Array<Record<string, unknown>>> {
  const actorId = process.env.APIFY_ACTOR_INFLUENCER_INSTAGRAM || INSTAGRAM_INFLUENCER_ACTOR
  const run = await apifyClient.actor(actorId).call(buildInstagramInfluencerInput(params))
  const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems({ limit })
  return (items as Record<string, unknown>[])
    .map((item) => normalizeInstagramInfluencer(item, params))
    .filter((item): item is Record<string, unknown> => Boolean(item))
}

async function executeTikTokInfluencerSearch(
  params: Record<string, unknown>,
  limit: number
): Promise<Array<Record<string, unknown>>> {
  const actorId = process.env.APIFY_ACTOR_INFLUENCER_TIKTOK || TIKTOK_INFLUENCER_ACTOR
  const run = await apifyClient.actor(actorId).call(buildTikTokInfluencerInput(params))
  const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems({ limit })
  return (items as Record<string, unknown>[])
    .map((item) => normalizeTikTokInfluencer(item, params))
    .filter((item): item is Record<string, unknown> => Boolean(item))
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
      {
      const department = asString(params.department)?.toLowerCase()
      const industry = asString(params.industry)
      const company = asString(params.companyNameOrDomain)
      const query = [
        asString(params.description),
        asString(params.skills),
        department && !PEOPLE_FUNCTION_IDS[department] ? department : undefined,
        industry && !/^\d+(?:,\d+)*$/.test(industry) ? industry : undefined,
        company && !/linkedin\.com\/company\//i.test(company) ? company : undefined,
      ]
        .filter(Boolean)
        .join(" ")
        .slice(0, 300)

      return {
        searchQuery: query || undefined,
        locations: params.location ? [String(params.location)] : undefined,
        currentJobTitles: params.jobTitle ? [String(params.jobTitle)] : undefined,
        maxItems: getResultLimit(params.resultsLimit, 100),
        profileScraperMode: "Full + email search",
        seniorityLevelIds: asString(params.managementLevel) && PEOPLE_SENIORITY_IDS[String(params.managementLevel)]
          ? [PEOPLE_SENIORITY_IDS[String(params.managementLevel)]]
          : undefined,
        functionIds: department && PEOPLE_FUNCTION_IDS[department]
          ? [PEOPLE_FUNCTION_IDS[department]]
          : undefined,
        industryIds: industry && /^\d+(?:,\d+)*$/.test(industry)
          ? industry.split(",")
          : undefined,
        yearsOfExperienceIds: asString(params.yearsOfExperience) && PEOPLE_EXPERIENCE_IDS[String(params.yearsOfExperience)]
          ? [PEOPLE_EXPERIENCE_IDS[String(params.yearsOfExperience)]]
          : undefined,
        currentCompanies: company && /linkedin\.com\/company\//i.test(company)
          ? [company]
          : undefined,
        recentlyChangedJobs: params.changedJobsWithin === "90" ? true : undefined,
        schools: params.school ? [String(params.school)] : undefined,
        companyHeadcount: asString(params.employeeCount) && PEOPLE_HEADCOUNT_IDS[String(params.employeeCount)]
          ? [PEOPLE_HEADCOUNT_IDS[String(params.employeeCount)]]
          : undefined,
      }
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
          company_sizes: asString(params.employeeCount) && COMPANY_SIZE_VALUES[String(params.employeeCount)]
            ? [COMPANY_SIZE_VALUES[String(params.employeeCount)]]
            : undefined,
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
          businessAccountsOnly:
            params.accountType === "business" || params.accountType === "creator"
              ? true
              : undefined,
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

        const fullName =
          asString(item.fullName) ||
          asString(item.name) ||
          `${asString(item.firstName) || ""} ${asString(item.lastName) || ""}`.trim() ||
          null
        const linkedinUrl =
          asString(item.linkedinUrl) ||
          asString(item.profileUrl) ||
          asString(item.url) ||
          null
        if (!fullName && !linkedinUrl) break

        const currentPosition = getCurrentPosition(item)
        const currentCompany = getNestedRecord(currentPosition, "company")
        const industries = Array.isArray(currentCompany?.industries)
          ? currentCompany.industries
          : []

        normalized.push({
          ...base,
          fullName,
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
          linkedinUrl,
          companyName: getCompanyNameFromProfile(item),
          companyWebsite: getCompanyWebsiteFromProfile(item),
          companyLinkedin: getCompanyLinkedInFromProfile(item),
          companySize: asString(currentCompany?.employeeCount) ||
            (typeof currentCompany?.employeeCount === "number"
              ? String(currentCompany.employeeCount)
              : null),
          companyIndustry: industries
            .map((industry) =>
              typeof industry === "string"
                ? industry
                : asString((industry as Record<string, unknown>)?.name)
            )
            .filter(Boolean)
            .join(", ") || null,
          avatarUrl:
            asString((item.profilePicture as Record<string, unknown> | undefined)?.url) ||
            asString(item.photo) ||
            asString(item.avatarUrl) ||
            null,
        })
        break
      }

      case "LOCAL":
        // Google Maps output
        if (!asString(item.name) && !asString(item.title)) break
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
        if (!asString(item.name) && !asString(item.companyName)) break
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
          if (
            !asString(item.displayName) &&
            !asString(item.name) &&
            !asString(item.username) &&
            !asString(profileUrl)
          ) break

          normalized.push({
          ...base,
          fullName: item.displayName || item.name || item.fullName || item.username || null,
          username: item.username || item.handle || null,
          platform,
          followerCount: item.followerCount || item.followers || null,
          engagementRate: asNumber(item.engagementRate) ?? asNumber(item.engagement) ?? null,
          bio: item.bio || item.description || null,
          avatarUrl: item.avatarUrl || item.profilePicUrl || item.avatar || item.profilePicture || null,
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

function dedupeResults(leads: Array<Record<string, unknown>>) {
  const seen = new Set<string>()
  return leads.filter((lead) => {
    const key =
      asString(lead.email)?.toLowerCase() ||
      asString(lead.linkedinUrl)?.toLowerCase() ||
      (asString(lead.platform) && asString(lead.username)
        ? `${asString(lead.platform)}:${asString(lead.username)}`.toLowerCase()
        : undefined) ||
      (asString(lead.companyName)
        ? `${asString(lead.companyName)}:${asString(lead.location) || ""}`.toLowerCase()
        : undefined) ||
      (asString(lead.fullName)
        ? `${asString(lead.fullName)}:${asString(lead.companyName) || ""}`.toLowerCase()
        : undefined)

    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// Main search execution function
export async function executeSearch(
  type: SearchType,
  params: Record<string, unknown>,
  runOptions: {
    existingRunId?: string | null
    onRunStarted?: (runId: string) => Promise<void>
  } = {}
) {
  assertSearchConfigured(type, params)
  const limit = getResultLimit(params.resultsLimit, type === "PEOPLE" ? 100 : 50)

  if (type === "DOMAIN") {
    const results = await executeDomainPeopleSearch(params, limit)
    if (results.length > 0) return dedupeResults(results).slice(0, limit)

    return dedupeResults(await fallbackDomainContacts(params, limit)).slice(0, limit)
  }

  if (type === "INFLUENCER" && params.platform === "youtube") {
    const results = await executeYouTubeInfluencerSearch(params, limit)
    if (results.length > 0) return dedupeResults(results).slice(0, limit)
  }

  if (type === "INFLUENCER" && params.platform === "instagram") {
    return dedupeResults(await executeInstagramInfluencerSearch(params, limit)).slice(0, limit)
  }

  if (type === "INFLUENCER" && params.platform === "tiktok") {
    return dedupeResults(await executeTikTokInfluencerSearch(params, limit)).slice(0, limit)
  }

  const actorId = getActorId(type)
  const input = buildActorInput(type, params)

  try {
    const run = runOptions.existingRunId
      ? await apifyClient.run(runOptions.existingRunId).waitForFinish()
      : await apifyClient.actor(actorId).start(input).then(async (started) => {
          await runOptions.onRunStarted?.(started.id)
          return apifyClient.run(started.id).waitForFinish()
        })
    if (run.status !== "SUCCEEDED") {
      throw new Error(`Search provider run ended with status ${run.status}`)
    }
    const { items } = await apifyClient
      .dataset(run.defaultDatasetId)
      .listItems({ limit })

    const results = normalizeResults(type, items as Record<string, unknown>[])
    return dedupeResults(await enrichWebsiteEmails(type, results)).slice(0, limit)
  } catch (error) {
    throw error
  }
}

export { getActorId, buildActorInput, normalizeResults }
