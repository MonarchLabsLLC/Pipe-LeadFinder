import { z } from "zod"

const optionalProfileText = z.string().trim().max(10_000).optional()

export const businessProfileSchema = z.object({
  businessName: optionalProfileText,
  businessWebsite: z.string().trim().max(2_048).optional(),
  whatYouSell: optionalProfileText,
  whoItHelps: optionalProfileText,
  whatItDoes: optionalProfileText,
  contactPerson: z.string().trim().max(500).optional(),
  personality: z.string().trim().max(2_000).optional(),
})

export const dataSourceSchema = z.object({
  type: z.enum(["WEBSITE", "TEXT", "QA"]),
  content: z.string().trim().max(100_000).optional(),
  sourceUrl: z.string().trim().url().max(2_048).optional(),
  name: z.string().trim().max(200).optional(),
  crawlMode: z.enum(["website", "link"]).default("website"),
})

