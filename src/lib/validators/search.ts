import { z } from "zod"

// ─── People Search ──────────────────────────────────────

export const peopleSearchSchema = z.object({
  description: z.string().min(1),
  location: z.string().optional(),
  resultsLimit: z.number().int().min(1).max(100).default(10),
  listId: z.string().optional(),

  // Advanced filters
  jobTitle: z.string().optional(),
  department: z.string().optional(),
  managementLevel: z.string().optional(),
  changedJobsWithin: z.string().optional(),
  skills: z.string().optional(),
  yearsOfExperience: z.string().optional(),
  companyNameOrDomain: z.string().optional(),
  employeeCount: z.string().optional(),
  revenue: z.string().optional(),
  industry: z.string().optional(),
  contactMethod: z.string().optional(),
  major: z.string().optional(),
  school: z.string().optional(),
  degree: z.string().optional(),
  socialLink: z.string().optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
})

export type PeopleSearchInput = z.infer<typeof peopleSearchSchema>

// ─── Local Search ───────────────────────────────────────

export const localSearchSchema = z.object({
  businessType: z.string().min(1),
  location: z.string().min(1),
  listId: z.string().optional(),
})

export type LocalSearchInput = z.infer<typeof localSearchSchema>

// ─── Company Search ─────────────────────────────────────

export const companySearchSchema = z.object({
  description: z.string().optional(),
  location: z.string().optional(),
  radius: z.number().optional(),
  resultsLimit: z.number().int().min(1).max(100).default(10),
  industry: z.string().optional(),
  companyName: z.string().optional(),
  domain: z.string().optional(),
  technologies: z.string().optional(),
  keyword: z.string().optional(),
  employeeCount: z.string().optional(),
  revenue: z.string().optional(),
  listId: z.string().optional(),
})

export type CompanySearchInput = z.infer<typeof companySearchSchema>

// ─── Domain Search ──────────────────────────────────────

export const domainSearchSchema = z.object({
  companyNameOrWebsite: z.string().min(1),
  listId: z.string().optional(),
})

export type DomainSearchInput = z.infer<typeof domainSearchSchema>

// ─── Influencer Search ──────────────────────────────────

const audienceSchema = z.object({
  age: z.string().optional(),
  credibility: z.number().optional(),
  gender: z.string().optional(),
  language: z.string().optional(),
  interests: z.string().optional(),
  locations: z.string().optional(),
})

export const influencerSearchSchema = z.object({
  platform: z.enum(["instagram", "tiktok", "youtube"]).default("instagram"),
  hashtags: z.array(z.string()).optional(),
  description: z.string().optional(),
  followersFrom: z.number().optional(),
  followersTo: z.number().optional(),
  ageFrom: z.string().optional(),
  ageTo: z.string().optional(),
  reelsPlaysFrom: z.number().optional(),
  reelsPlaysTo: z.number().optional(),
  engagementsFrom: z.number().optional(),
  engagementsTo: z.number().optional(),
  engagementRate: z.number().optional(),
  language: z.string().optional(),
  gender: z.string().optional(),
  lastPostDays: z.number().optional(),
  contactDetails: z.string().optional(),
  partnership: z.string().optional(),
  category: z.string().optional(),
  accountType: z.string().optional(),
  followersGrowthInterval: z.string().optional(),
  followersGrowthOperator: z.string().optional(),
  followersGrowthValue: z.number().optional(),
  verified: z.boolean().optional(),
  hasSponsoredPosts: z.boolean().optional(),
  audience: audienceSchema.optional(),
  username: z.string().optional(),
  location: z.string().optional(),
  listId: z.string().optional(),
})

export type InfluencerSearchInput = z.infer<typeof influencerSearchSchema>
