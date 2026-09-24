/**
 * "Describe who you want": turns a sentence into one of the five searches and
 * the fields of its form. The model only proposes; every field it returns is
 * coerced and validated one by one against the real search schema, and
 * anything that fails is dropped. The user always reviews the pre-filled form
 * before a search runs, so this never spends search credits itself.
 */

import { generateText, Output } from "ai"
import { z } from "zod"
import {
  companySearchSchema,
  domainSearchSchema,
  influencerSearchSchema,
  localSearchSchema,
  peopleSearchSchema,
} from "@/lib/validators/search"
import { getAiLanguageModel, getAiRuntimeConfig } from "@/services/ai-runtime"
import { consumeTokenCredits } from "@/services/credits-service"
import {
  SEARCH_RESULT_LIMITS,
  snapResultsLimit,
  type SearchTypeKey,
} from "@/lib/search-summary"

export const INTERPRET_AI_CONFIG = getAiRuntimeConfig("search-interpret")

/** What the request body may contain. */
export const interpretRequestSchema = z
  .object({ text: z.string().trim().min(3, "Tell us a little more").max(500) })
  .strict()

const SEARCH_TYPES = ["PEOPLE", "LOCAL", "COMPANY", "DOMAIN", "INFLUENCER"] as const

/**
 * What the model must return. Fields are loose name/value strings on purpose:
 * strict structured outputs cannot express five different optional shapes, and
 * everything is validated against the real schemas afterwards anyway.
 */
export const interpretModelSchema = z.object({
  searchType: z.enum([...SEARCH_TYPES, "UNCLEAR"]),
  explanation: z.string(),
  fields: z.array(z.object({ name: z.string(), value: z.string() })),
})

export type InterpretModelOutput = z.infer<typeof interpretModelSchema>

// Zod objects wrapped in .refine() keep their shape in Zod 4.
const SHAPES: Record<SearchTypeKey, Record<string, z.ZodType>> = {
  PEOPLE: peopleSearchSchema.shape,
  LOCAL: localSearchSchema.shape,
  COMPANY: companySearchSchema.shape,
  DOMAIN: domainSearchSchema.shape,
  INFLUENCER: influencerSearchSchema.shape,
}

/** Never taken from the model: the user picks where results go. */
const NEVER_FROM_MODEL = new Set(["listId", "duplicatePolicy"])
const NUMERIC_FIELDS = new Set(["resultsLimit", "followersFrom", "followersTo", "engagementRate"])

const DEFAULT_REASONS: Record<SearchTypeKey, string> = {
  PEOPLE: "you described people by their job",
  LOCAL: "you described businesses in a place",
  COMPANY: "you described a kind of company",
  DOMAIN: "you named one company to find people at",
  INFLUENCER: "you described social media creators",
}

const SYSTEM_PROMPT = `You turn a sales prospector's description into ONE lead search.
Pick the searchType:
- PEOPLE: individuals by job title, seniority, industry or location ("marketing directors at SaaS companies in Texas").
- LOCAL: brick-and-mortar or service businesses in a town, city or ZIP ("dentists in Tampa, FL", "plumbers near Austin").
- COMPANY: companies matching a profile (industry, size, technology, location) when the user wants companies, not people.
- DOMAIN: people who work at ONE named company or website ("people at acme.com", "staff of Stripe").
- INFLUENCER: Instagram, TikTok or YouTube creators ("fitness creators with 10k-100k followers").
- UNCLEAR: the text is not a description of leads, is gibberish, or asks for something else.

Return only fields that the text supports; never invent values. Fields per type (name: meaning):
PEOPLE: description (short job or role, e.g. "Marketing Director"), location, jobTitle, department, managementLevel (entry|senior|manager|director|vp|c-level|owner), skills, yearsOfExperience (0-1|1-3|3-5|5-10|10+), companyNameOrDomain, employeeCount (1-10|11-50|51-200|201-500|501-1000|1001-5000|5001-10000|10001+), industry, school, resultsLimit.
LOCAL: businessType (singular, e.g. "Dentist"), location ("City, ST"), resultsLimit.
COMPANY: description, location, industry, companyName, domain, technologies, keyword, employeeCount (same values as above), resultsLimit.
DOMAIN: companyNameOrWebsite (a domain like "acme.com" or a company name), resultsLimit.
INFLUENCER: platform (instagram|tiktok|youtube), description (the niche), location, category (art|beauty|business|education|fashion|fitness|food|gaming|health|lifestyle|music|photography|sports|technology|travel), followersFrom, followersTo (plain integers), engagementRate (percent), language (en|es|fr|de|pt|it|ja|ko|zh|ar|hi|any), accountType (any|business|creator), verified (true|false), hashtags (comma separated), resultsLimit.
Only set resultsLimit when the user states a number of results.
Every value is a string. explanation: one short sentence starting with "you" saying why this search fits, e.g. "you described businesses in a place".`

export type InterpretResult =
  | {
      ok: true
      searchType: SearchTypeKey
      fields: Record<string, unknown>
      explanation: string
      droppedFields: string[]
    }
  | { ok: false; reason: "unclear"; message: string }

export const UNCLEAR_MESSAGE =
  "We couldn't turn that into a search. Try describing who you want and where, like \"dentists in Tampa, FL\", or pick a search below."

function parseNumber(raw: string): number | undefined {
  const cleaned = raw.trim().toLowerCase().replace(/[,%\s]/g, "")
  const match = cleaned.match(/^(\d+(?:\.\d+)?)([km])?$/)
  if (!match) return undefined
  const base = Number(match[1])
  const multiplier = match[2] === "k" ? 1_000 : match[2] === "m" ? 1_000_000 : 1
  return base * multiplier
}

function coerce(name: string, raw: string): unknown {
  if (NUMERIC_FIELDS.has(name)) return parseNumber(raw)
  if (name === "hashtags") {
    const tags = raw
      .split(/[,\s]+/)
      .map((tag) => tag.replace(/^#/, "").trim())
      .filter(Boolean)
    return tags.length > 0 ? tags : undefined
  }
  if (name === "verified") {
    const value = raw.trim().toLowerCase()
    return value === "true" ? true : value === "false" ? false : undefined
  }
  if (["platform", "managementLevel", "language", "accountType", "category"].includes(name)) {
    return raw.trim().toLowerCase()
  }
  return raw
}

/**
 * Keep only fields that exist on the chosen search and pass its schema.
 * Exported for tests: this is the part that must never trust the model.
 */
export function sanitizeInterpretedFields(
  searchType: SearchTypeKey,
  rawFields: { name: string; value: string }[]
): { fields: Record<string, unknown>; dropped: string[] } {
  const shape = SHAPES[searchType]
  const fields: Record<string, unknown> = {}
  const dropped: string[] = []

  for (const { name, value } of rawFields) {
    if (typeof name !== "string" || typeof value !== "string") continue
    if (!Object.hasOwn(shape, name) || NEVER_FROM_MODEL.has(name) || name in fields) {
      dropped.push(String(name))
      continue
    }
    if (value.trim() === "") continue
    let candidate = coerce(name, value)
    if (name === "resultsLimit") {
      candidate = snapResultsLimit(candidate, SEARCH_RESULT_LIMITS[searchType])
    }
    if (candidate === undefined) {
      dropped.push(name)
      continue
    }
    const parsed = shape[name].safeParse(candidate)
    if (!parsed.success || parsed.data === undefined || parsed.data === "") {
      dropped.push(name)
      continue
    }
    fields[name] = parsed.data
  }

  if (
    typeof fields.followersFrom === "number" &&
    typeof fields.followersTo === "number" &&
    fields.followersFrom > fields.followersTo
  ) {
    delete fields.followersFrom
    delete fields.followersTo
    dropped.push("followersFrom", "followersTo")
  }

  return { fields, dropped }
}

function cleanExplanation(searchType: SearchTypeKey, raw: string) {
  const text = raw.replace(/\s+/g, " ").trim().replace(/^because\s+/i, "")
  if (text.length < 8 || text.length > 160) return DEFAULT_REASONS[searchType]
  const sentence = text.replace(/[.!]+$/, "")
  return sentence.charAt(0).toLowerCase() + sentence.slice(1)
}

export interface InterpretDeps {
  generate: (text: string) => Promise<{
    output: InterpretModelOutput
    usage: { inputTokens?: number; outputTokens?: number }
  }>
  bill: typeof consumeTokenCredits
}

async function generateWithModel(text: string) {
  const { output, usage } = await generateText({
    model: getAiLanguageModel(INTERPRET_AI_CONFIG),
    output: Output.object({ schema: interpretModelSchema, name: "lead_search" }),
    system: SYSTEM_PROMPT,
    prompt: text,
    maxOutputTokens: 2_000,
  })
  return { output, usage }
}

const defaultDeps: InterpretDeps = { generate: generateWithModel, bill: consumeTokenCredits }

export async function interpretSearch(
  input: { text: string; userId: string; email?: string | null; idempotencyKey?: string },
  deps: InterpretDeps = defaultDeps
): Promise<InterpretResult> {
  const { output, usage } = await deps.generate(input.text)

  // Tokens were spent whatever the answer, so bill like every other AI action.
  if (usage?.inputTokens || usage?.outputTokens) {
    await deps.bill(
      input.userId,
      {
        provider: INTERPRET_AI_CONFIG.provider,
        model: INTERPRET_AI_CONFIG.model,
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
        idempotencyKey: input.idempotencyKey,
      },
      input.email
    )
  }

  const checked = interpretModelSchema.safeParse(output)
  if (!checked.success || checked.data.searchType === "UNCLEAR") {
    return { ok: false, reason: "unclear", message: UNCLEAR_MESSAGE }
  }

  const searchType = checked.data.searchType
  const { fields, dropped } = sanitizeInterpretedFields(searchType, checked.data.fields)
  const meaningful = Object.keys(fields).filter((key) => key !== "resultsLimit")
  if (meaningful.length === 0) {
    return { ok: false, reason: "unclear", message: UNCLEAR_MESSAGE }
  }

  return {
    ok: true,
    searchType,
    fields,
    explanation: cleanExplanation(searchType, checked.data.explanation),
    droppedFields: dropped,
  }
}
