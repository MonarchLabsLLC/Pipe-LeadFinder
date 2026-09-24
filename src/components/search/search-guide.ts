/**
 * The plain-English copy behind the New Search welcome: what each search is
 * for, what it returns, its example searches and the result limits its form
 * offers. One file so the cards, the AI box and the docs say the same thing.
 */

import { Building2, Globe, MapPin, Star, Users, type LucideIcon } from "lucide-react"
import { SearchType } from "@/generated/prisma/enums"
import type { PipeLeadsCreditAction } from "@/lib/pipeleads-credit-pricing"
import { SEARCH_RESULT_LIMITS } from "@/lib/search-summary"

export interface SearchExample {
  /** What the chip says. */
  label: string
  /** Values pre-filled into the form (never a list or a duplicate policy). */
  values: Record<string, unknown>
}

export interface SearchGuideEntry {
  type: SearchType
  /** Short name used in badges and explanations ("Local search"). */
  name: string
  headline: string
  bestFor: string
  youGet: string
  icon: LucideIcon
  creditAction: PipeLeadsCreditAction
  /** Singular noun the price is per ("contact", "business"). */
  creditUnit: string
  /** Extra line under the cost estimate, when a search bills differently. */
  costNote?: string
  /** The options of the form's "Results limit" select. */
  limitOptions: readonly number[]
  examples: SearchExample[]
}

export const SEARCH_GUIDE: SearchGuideEntry[] = [
  {
    type: SearchType.PEOPLE,
    name: "People search",
    headline: "Find people by job",
    bestFor: "Decision-makers by title, industry and location",
    youGet: "Name, title, company, email, phone, LinkedIn",
    icon: Users,
    creditAction: "search:people",
    creditUnit: "contact",
    limitOptions: SEARCH_RESULT_LIMITS.PEOPLE,
    examples: [
      {
        label: "Marketing directors at SaaS companies in Texas",
        values: { description: "Marketing Director", industry: "SaaS", location: "Texas" },
      },
    ],
  },
  {
    type: SearchType.LOCAL,
    name: "Local search",
    headline: "Find local businesses",
    bestFor: "Shops, clinics and agencies in a town or city",
    youGet: "Business, phone, website, address, email",
    icon: MapPin,
    creditAction: "search:local",
    creditUnit: "business",
    costNote: "Businesses without an email are free.",
    limitOptions: SEARCH_RESULT_LIMITS.LOCAL,
    examples: [
      { label: "Dentists in Tampa, FL", values: { businessType: "Dentist", location: "Tampa, FL" } },
      { label: "Gyms in Austin, TX", values: { businessType: "Gym", location: "Austin, TX" } },
    ],
  },
  {
    type: SearchType.COMPANY,
    name: "Company search",
    headline: "Find companies",
    bestFor: "Companies that match a profile",
    youGet: "Company, website, size, industry, location",
    icon: Building2,
    creditAction: "search:company",
    creditUnit: "company",
    limitOptions: SEARCH_RESULT_LIMITS.COMPANY,
    examples: [
      {
        label: "Marketing agencies with 11–50 employees",
        values: { description: "Marketing agency", employeeCount: "11-50" },
      },
    ],
  },
  {
    type: SearchType.DOMAIN,
    name: "Domain search",
    headline: "Find people at one company",
    bestFor: "When you already know the company",
    youGet: "Staff names, titles, emails",
    icon: Globe,
    creditAction: "search:domain",
    creditUnit: "contact",
    limitOptions: SEARCH_RESULT_LIMITS.DOMAIN,
    examples: [{ label: "acme.com", values: { companyNameOrWebsite: "acme.com" } }],
  },
  {
    type: SearchType.INFLUENCER,
    name: "Influencer search",
    headline: "Find creators",
    bestFor: "Instagram, TikTok and YouTube creators",
    youGet: "Handle, followers, engagement, email",
    icon: Star,
    creditAction: "search:influencer",
    creditUnit: "profile",
    limitOptions: SEARCH_RESULT_LIMITS.INFLUENCER,
    examples: [
      {
        label: "Fitness creators, 10k–100k followers",
        values: {
          platform: "instagram",
          description: "Fitness creators",
          category: "fitness",
          followersFrom: 10000,
          followersTo: 100000,
          location: "United States",
        },
      },
    ],
  },
]

export const SEARCH_GUIDE_BY_TYPE = Object.fromEntries(
  SEARCH_GUIDE.map((entry) => [entry.type, entry])
) as Record<SearchType, SearchGuideEntry>

/** Rotating placeholders of the "Describe who you want" box. */
export const DESCRIBE_EXAMPLES = [
  "dentists in Tampa, FL",
  "marketing directors at SaaS companies in Texas",
  "fitness creators on Instagram with 10k–100k followers",
  "people who work at acme.com",
  "marketing agencies with 11–50 employees",
] as const
