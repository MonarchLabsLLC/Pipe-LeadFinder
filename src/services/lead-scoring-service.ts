import { generateText } from "ai"
import { prisma } from "@/lib/prisma"
import {
  buildLeadScorePromptTag,
  type LeadScoreLabel,
  type LeadScoreSummary,
} from "@/lib/lead-score"
import { getBusinessContext } from "@/services/ai-service"
import {
  getAiLanguageModel,
  getAiRuntimeConfig,
} from "@/services/ai-runtime"
import { consumeTokenCredits } from "@/services/credits-service"
import type { Lead } from "@/generated/prisma/client"

const LEAD_SCORING_AI_CONFIG = getAiRuntimeConfig("scoring")

type LeadForScoring = Pick<
  Lead,
  | "id"
  | "fullName"
  | "firstName"
  | "lastName"
  | "title"
  | "headline"
  | "location"
  | "city"
  | "state"
  | "country"
  | "email"
  | "phone"
  | "linkedinUrl"
  | "companyName"
  | "companyWebsite"
  | "companySize"
  | "companyRevenue"
  | "companyIndustry"
  | "sourceType"
  | "platform"
  | "username"
  | "followerCount"
  | "engagementRate"
  | "bio"
>

interface RawLeadScore extends Partial<LeadScoreSummary> {
  leadId?: string
  id?: string
}

export interface ScoreLeadsResult {
  scoredCount: number
  leadScores: Array<LeadScoreSummary & { leadId: string }>
  model: string
}

function leadName(lead: LeadForScoring) {
  return (
    lead.fullName ||
    [lead.firstName, lead.lastName].filter(Boolean).join(" ") ||
    "Unknown"
  )
}

function leadLocation(lead: LeadForScoring) {
  return (
    lead.location ||
    [lead.city, lead.state, lead.country].filter(Boolean).join(", ") ||
    null
  )
}

function compactLead(lead: LeadForScoring) {
  return {
    id: lead.id,
    name: leadName(lead),
    title: lead.title,
    headline: lead.headline,
    location: leadLocation(lead),
    emailAvailable: Boolean(lead.email),
    phoneAvailable: Boolean(lead.phone),
    linkedinUrl: lead.linkedinUrl,
    companyName: lead.companyName,
    companyWebsite: lead.companyWebsite,
    companySize: lead.companySize,
    companyRevenue: lead.companyRevenue,
    companyIndustry: lead.companyIndustry,
    sourceType: lead.sourceType,
    platform: lead.platform,
    username: lead.username,
    followerCount: lead.followerCount,
    engagementRate: lead.engagementRate,
    bio: lead.bio,
  }
}

function extractJsonArray(text: string) {
  const trimmed = text.trim()
  if (trimmed.startsWith("[")) return trimmed

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) return fenced[1].trim()

  const start = trimmed.indexOf("[")
  const end = trimmed.lastIndexOf("]")
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1)

  throw new Error("AI scoring response did not contain a JSON array")
}

function clampScore(score: unknown) {
  const parsed = typeof score === "number" ? score : Number(score)
  if (!Number.isFinite(parsed)) return 0
  return Math.min(100, Math.max(0, Math.round(parsed)))
}

function labelForScore(label: unknown, score: number): LeadScoreLabel {
  if (
    label === "Hot" ||
    label === "Warm" ||
    label === "Research" ||
    label === "Low"
  ) {
    return label
  }
  if (score >= 80) return "Hot"
  if (score >= 60) return "Warm"
  if (score >= 40) return "Research"
  return "Low"
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeScore(raw: RawLeadScore) {
  const score = clampScore(raw.score)
  const why = Array.isArray(raw.why)
    ? raw.why.map(stringValue).filter(Boolean).slice(0, 4)
    : []

  return {
    leadId: stringValue(raw.leadId || raw.id),
    score,
    label: labelForScore(raw.label, score),
    bestAngle: stringValue(raw.bestAngle),
    why,
    suggestedOpener: stringValue(raw.suggestedOpener),
    nextAction: stringValue(raw.nextAction),
  }
}

export async function scoreLeadsForList({
  userId,
  email,
  listId,
  leads,
}: {
  userId: string
  email?: string | null
  listId: string
  leads: LeadForScoring[]
}): Promise<ScoreLeadsResult> {
  if (leads.length === 0) {
    return {
      scoredCount: 0,
      leadScores: [],
      model: LEAD_SCORING_AI_CONFIG.model,
    }
  }

  const businessContext = await getBusinessContext(userId)
  const promptTag = buildLeadScorePromptTag(listId)
  const now = new Date().toISOString()
  const compactLeads = leads.map(compactLead)

  const { text, usage } = await generateText({
    model: getAiLanguageModel(LEAD_SCORING_AI_CONFIG),
    system: `You are a senior sales strategist ranking leads for outbound prospecting.
Score each lead from 0 to 100 based on fit to the business context, seniority, relevance, company fit, data completeness, and likely outreach quality.
Return only a valid JSON array. Do not include markdown or prose.`,
    prompt: `Business context:
${businessContext}

Leads to score:
${JSON.stringify(compactLeads, null, 2)}

Return one JSON object for every lead using this exact shape:
{
  "leadId": "lead id from input",
  "score": 0-100 integer,
  "label": "Hot" | "Warm" | "Research" | "Low",
  "bestAngle": "short reason this prospect might care",
  "why": ["2-4 concise fit reasons"],
  "suggestedOpener": "one short first-line opener, under 180 characters",
  "nextAction": "one concrete next step"
}`,
  })

  const parsed = JSON.parse(extractJsonArray(text)) as RawLeadScore[]
  const leadIds = new Set(leads.map((lead) => lead.id))
  const leadScores = parsed
    .map(normalizeScore)
    .filter((score) => score.leadId && leadIds.has(score.leadId))
    .map((score) => ({
      ...score,
      scoredAt: now,
      model: LEAD_SCORING_AI_CONFIG.model,
    }))

  await prisma.aiResult.createMany({
    data: leadScores.map((score) => ({
      leadId: score.leadId,
      actionType: "CUSTOM",
      prompt: promptTag,
      result: JSON.stringify(score),
      model: LEAD_SCORING_AI_CONFIG.model,
    })),
  })

  if (usage?.inputTokens || usage?.outputTokens) {
    consumeTokenCredits(
      userId,
      {
        provider: LEAD_SCORING_AI_CONFIG.provider,
        model: LEAD_SCORING_AI_CONFIG.model,
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
      },
      email
    ).catch(() => {})
  }

  return {
    scoredCount: leadScores.length,
    leadScores,
    model: LEAD_SCORING_AI_CONFIG.model,
  }
}
