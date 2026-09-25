/**
 * Helpers behind the Agent's newer read tools and the input builders for the
 * proposals that select records server-side (bulk enrichment, rerun).
 */
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getBalance, getPipeLeadsPricing } from "@/services/credits-service"
import {
  generateWithModel,
  interpretSearch,
  type InterpretDeps,
} from "@/services/search-interpret-service"
import { CREDIT_COSTS } from "@/lib/pipeleads-credit-pricing"
import { id, ownedList, listUrl } from "./resources"
import { FocusedAgentError } from "./security"
import { DEV_BALANCE } from "./pricing"
import { devBypass } from "./dev-bypass"
import type { AgentActor } from "./access"

/**
 * ask_user: one question, 2-4 short options. The UI always adds a free-text
 * "Something else" answer when allowOther is true.
 */
export const askUserSchema = z
  .object({
    question: z.string().trim().min(3).max(200),
    options: z.array(z.string().trim().min(1).max(60)).min(2).max(4),
    allowOther: z.boolean().default(true),
  })
  .strict()
export type AskUser = z.infer<typeof askUserSchema>

export const bulkEnrichRequestSchema = z
  .object({
    listId: id,
    field: z.enum(["email", "phone"]).default("email"),
    limit: z.number().int().min(1).max(500).default(100),
  })
  .strict()

export const rerunSchema = z
  .object({
    searchId: id,
    resultsLimit: z.number().int().min(1).max(100).optional(),
  })
  .strict()

const REQUIRED: Record<string, string[][]> = {
  // Each inner array is "at least one of".
  PEOPLE: [["description"]],
  LOCAL: [["businessType"], ["location"]],
  COMPANY: [["description", "industry", "companyName", "domain", "technologies", "keyword"]],
  DOMAIN: [["companyNameOrWebsite"]],
  INFLUENCER: [["description"], ["location"], ["platform"]],
}

/** Which required details are still missing for this search type. */
export function missingSearchFields(type: string, fields: Record<string, unknown>) {
  const present = (key: string) =>
    fields[key] !== undefined && fields[key] !== null && String(fields[key]).trim() !== ""
  return (REQUIRED[type] ?? [])
    .filter((group) => !group.some(present))
    .map((group) => group.join(" or "))
}

export async function interpretRequest(a: AgentActor, text: string, key: string) {
  const deps: InterpretDeps | undefined = devBypass()
    ? {
        // Development only: the tokens are not charged.
        generate: generateWithModel,
        bill: async () => null,
      }
    : undefined
  const result = await interpretSearch(
    { text, userId: a.userId, email: a.email, idempotencyKey: `focused-agent:interpret:${key}` },
    deps
  )
  if (!result.ok) return { ok: false, message: result.message }
  const missing = missingSearchFields(result.searchType, result.fields)
  return {
    ok: true,
    searchType: result.searchType,
    fields: result.fields,
    explanation: result.explanation,
    missingRequired: missing,
    resultsLimitGiven: result.fields.resultsLimit !== undefined,
    note: "listId is never inferred: use an existing list of the same type or a new list name.",
  }
}

export async function creditsOverview(a: AgentActor) {
  if (devBypass()) {
    return {
      balance: DEV_BALANCE,
      development: true,
      prices: Object.entries(CREDIT_COSTS).map(([action, credits]) => ({ action, creditsPerResult: credits })),
    }
  }
  const [balance, pricing] = await Promise.all([
    getBalance(a.userId, a.email),
    getPipeLeadsPricing(),
  ])
  if (!balance || !Number.isFinite(balance.availableCredits))
    throw new FocusedAgentError(
      "BILLING_UNAVAILABLE",
      "Current Scale Credits could not be verified.",
      503,
      true
    )
  return {
    balance: balance.availableCredits,
    prices: (pricing ?? [])
      .filter((row) => row.configured)
      .map((row) => ({ action: row.action, creditsPerResult: row.creditsPerHit })),
    note: "Local and domain searches only charge for results with an email; enrichment only charges on success.",
  }
}

export async function recentSearches(a: AgentActor, limit: number) {
  const rows = await prisma.searchHistory.findMany({
    where: { userId: a.userId, list: { status: "ACTIVE" } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      searchType: true,
      parameters: true,
      resultCount: true,
      status: true,
      createdAt: true,
      list: { select: { id: true, name: true } },
    },
  })
  return {
    searches: rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      list: row.list ? { ...row.list, url: listUrl(row.list.id) } : null,
    })),
  }
}

/** Build the prepare_search input for a prior search, in its own list. */
export async function rerunSearchInput(a: AgentActor, raw: unknown) {
  const v = rerunSchema.parse(raw)
  const prior = await prisma.searchHistory.findFirst({
    where: { id: v.searchId, userId: a.userId },
    include: { list: { select: { id: true, status: true } } },
  })
  if (!prior?.list || prior.list.status !== "ACTIVE")
    throw new FocusedAgentError(
      "SEARCH_NOT_FOUND",
      "That search is not available to run again.",
      404
    )
  const parameters = {
    ...(prior.parameters as Record<string, unknown>),
    listId: prior.list.id,
    ...(v.resultsLimit ? { resultsLimit: v.resultsLimit } : {}),
  }
  return { type: prior.searchType, parameters }
}

/** Every lead in the list that lacks the field (and can be looked up), up to limit. */
export async function bulkEnrichSelection(a: AgentActor, raw: unknown) {
  const v = bulkEnrichRequestSchema.parse(raw)
  await ownedList(a, v.listId, true)
  const rows = await prisma.leadListEntry.findMany({
    where: {
      listId: v.listId,
      list: { userId: a.userId },
      lead:
        v.field === "email"
          ? { userId: a.userId, email: null }
          : { userId: a.userId, phone: null, linkedinUrl: { not: null } },
    },
    orderBy: { leadId: "asc" },
    take: v.limit,
    select: { leadId: true },
  })
  if (!rows.length)
    throw new FocusedAgentError(
      "NO_ELIGIBLE_LEADS",
      v.field === "email"
        ? "Every lead in this list already has an email. Nothing was started."
        : "No lead in this list is missing a phone and has a LinkedIn profile. Nothing was started.",
      409
    )
  return { listId: v.listId, field: v.field, leadIds: rows.map((row) => row.leadId) }
}
