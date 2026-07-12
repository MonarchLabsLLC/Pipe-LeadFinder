import { z } from "zod"

const optionalNumber = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return undefined
  if (typeof value === "number" && Number.isNaN(value)) return undefined

  const parsed = typeof value === "string" ? Number(value) : value
  return typeof parsed === "number" && Number.isNaN(parsed) ? undefined : parsed
}, z.number().optional())

const optionalText = (max = 500) => z.string().trim().max(max).optional()
const listIdSchema = z.string().trim().min(1, "Select a list").max(200)

// ─── People Search ──────────────────────────────────────

export const peopleSearchSchema = z.object({
  description: z.string().trim().min(1).max(300),
  location: optionalText(200),
  resultsLimit: z.number().int().min(1).max(100).default(10),
  listId: listIdSchema,

  // Advanced filters
  jobTitle: optionalText(200),
  department: optionalText(200),
  managementLevel: z.enum(["entry", "senior", "manager", "director", "vp", "c-level", "owner"]).optional(),
  changedJobsWithin: z.literal("90").optional(),
  skills: optionalText(300),
  yearsOfExperience: z.enum(["0-1", "1-3", "3-5", "5-10", "10+"]).optional(),
  companyNameOrDomain: optionalText(300),
  employeeCount: z.enum(["1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5001-10000", "10001+"]).optional(),
  industry: optionalText(200),
  school: optionalText(200),
}).strict()

export type PeopleSearchInput = z.infer<typeof peopleSearchSchema>

// ─── Local Search ───────────────────────────────────────

export const localSearchSchema = z.object({
  businessType: z.string().trim().min(1).max(200),
  location: z.string().trim().min(1).max(200),
  resultsLimit: z.number().int().min(1).max(50).default(10),
  listId: listIdSchema,
}).strict()

export type LocalSearchInput = z.infer<typeof localSearchSchema>

// ─── Company Search ─────────────────────────────────────

export const companySearchSchema = z.object({
  description: optionalText(300),
  location: optionalText(200),
  resultsLimit: z.number().int().min(1).max(50).default(10),
  industry: optionalText(200),
  companyName: optionalText(300),
  domain: optionalText(300),
  technologies: optionalText(300),
  keyword: optionalText(300),
  employeeCount: z.enum(["1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5001-10000", "10001+"]).optional(),
  listId: listIdSchema,
}).strict().refine(
  (value) =>
    Boolean(
      value.description ||
        value.industry ||
        value.companyName ||
        value.domain ||
        value.technologies ||
        value.keyword
    ),
  { message: "Enter at least one company search criterion" }
)

export type CompanySearchInput = z.infer<typeof companySearchSchema>

// ─── Domain Search ──────────────────────────────────────

export const domainSearchSchema = z.object({
  companyNameOrWebsite: z.string().trim().min(1).max(300),
  resultsLimit: z.number().int().min(1).max(50).default(10),
  listId: listIdSchema,
}).strict()

export type DomainSearchInput = z.infer<typeof domainSearchSchema>

// ─── Influencer Search ──────────────────────────────────

export const influencerSearchSchema = z
  .object({
    platform: z.enum(["instagram", "tiktok", "youtube"]).default("instagram"),
    resultsLimit: z.number().int().min(10).max(50).default(10),
    hashtags: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
    description: z.string().trim().min(1, "Description is required").max(300),
    followersFrom: optionalNumber.pipe(z.number().int().nonnegative().optional()),
    followersTo: optionalNumber.pipe(z.number().int().nonnegative().optional()),
    engagementRate: optionalNumber.pipe(z.number().min(0.1).max(50).optional()),
    language: z
      .enum(["en", "es", "fr", "de", "pt", "it", "ja", "ko", "zh", "ar", "hi", "any"])
      .optional(),
    category: optionalText(100),
    accountType: z.enum(["any", "business", "creator"]).optional(),
    verified: z.boolean().optional(),
    username: optionalText(100),
    location: z.string().trim().min(1, "Location is required").max(200),
    listId: listIdSchema,
  })
  .strict()
  .refine(
    (value) =>
      value.followersFrom === undefined ||
      value.followersTo === undefined ||
      value.followersFrom <= value.followersTo,
    {
      message: "Minimum followers cannot exceed maximum followers",
      path: ["followersTo"],
    }
  )

export type InfluencerSearchInput = z.infer<typeof influencerSearchSchema>
