import { generateText } from "ai"
import { prisma } from "@/lib/prisma"
import { pickLeadFields } from "@/lib/pick-lead-fields"
import { executeSearch, getActorId } from "@/services/search-service"
import { enrichEmail, enrichPhone } from "@/services/enrich-service"
import {
  ensureCreditsAvailable,
  consumeCredits,
  consumeTokenCredits,
  CREDIT_COSTS,
  type CreditAction,
} from "@/services/credits-service"
import {
  getBusinessContext,
  getLeadContext,
  buildSystemPrompt,
  buildUserPrompt,
} from "@/services/ai-service"
import {
  getAiLanguageModel,
  getAiRuntimeConfig,
} from "@/services/ai-runtime"
import type { AiAgent, Lead } from "@/generated/prisma/client"
import type { SearchType } from "@/generated/prisma/enums"

const AGENT_AI_CONFIG = getAiRuntimeConfig("agent")

export type AgentSchedule = "manual" | "daily" | "weekly" | "monthly"

export interface AgentConfig {
  searchType?: SearchType
  searchDescription?: string
  searchLocation?: string
  searchParams?: Record<string, unknown>
  actions?: string[]
  connections?: string[]
  schedule?: AgentSchedule | string
  resultsLimit?: number
  listId?: string
  leadCount?: number
  lastScheduledRunAt?: string | null
  nextScheduledRunAt?: string | null
  lastScheduledStatus?: "running" | "completed" | "failed" | null
  lastScheduledError?: string | null
  schedulerLockAt?: string | null
}

export interface AgentRunUser {
  id: string
  email?: string | null
}

export interface AgentRunResult {
  status: "completed"
  agentId: string
  searchId: string
  listId: string
  leadCount: number
  totalLeadCount: number
  actionsRun: string[]
  actionErrors?: Array<{ leadId: string; action: string; error: string }>
  webhookResults?: Array<{ url: string; status: number | string }>
}

export class AgentRunError extends Error {
  status: number
  code?: string
  purchaseUrl?: string
  searchId?: string

  constructor(
    message: string,
    options: {
      status?: number
      code?: string
      purchaseUrl?: string
      searchId?: string
    } = {}
  ) {
    super(message)
    this.name = "AgentRunError"
    this.status = options.status ?? 500
    this.code = options.code
    this.purchaseUrl = options.purchaseUrl
    this.searchId = options.searchId
  }
}

function jsonConfig(config: AgentConfig) {
  return JSON.parse(JSON.stringify(config))
}

function getSearchCreditAction(searchType: SearchType): CreditAction {
  switch (searchType) {
    case "PEOPLE":
      return "search:people"
    case "LOCAL":
      return "search:local"
    case "COMPANY":
      return "search:company"
    case "DOMAIN":
      return "search:domain"
    case "INFLUENCER":
      return "search:influencer"
  }
}

function countBillableSearchResults(searchType: SearchType, leads: Lead[]) {
  if (searchType === "LOCAL") {
    return leads.filter((lead) => Boolean(lead.email)).length
  }
  return leads.length
}

function deductAgentCredits(
  userId: string,
  action: CreditAction,
  resultCount: number,
  meta?: { listId?: string; leadId?: string; searchType?: string }
) {
  const perUnit = CREDIT_COSTS[action]
  const total = perUnit * resultCount
  if (total <= 0) return

  consumeCredits(userId, {
    amount: total,
    description: `${action} x ${resultCount}`,
    metadata: {
      action,
      resultCount,
      ...meta,
    },
  }).catch((err) => {
    console.error("[AgentRunner] Credit deduction failed:", err)
  })
}

async function ensureAgentCredits(user: AgentRunUser) {
  const check = await ensureCreditsAvailable(user.id, user.email)
  if (!check.ok) {
    throw new AgentRunError(check.message || "Insufficient credits", {
      status: check.status || 402,
      code: "INSUFFICIENT_CREDITS",
      purchaseUrl: process.env.SCALECREDITS_URL || "https://credits.scaleplus.gg",
    })
  }
}

async function saveAiResult(
  user: AgentRunUser,
  leadId: string,
  actionType: "SUMMARY" | "DIRECT_MESSAGE"
) {
  const [leadContext, businessContext] = await Promise.all([
    getLeadContext(leadId),
    getBusinessContext(user.id),
  ])
  const systemPrompt = buildSystemPrompt(actionType, businessContext)
  const userPrompt = buildUserPrompt(actionType, leadContext)

  const { text, usage } = await generateText({
    model: getAiLanguageModel(AGENT_AI_CONFIG),
    system: systemPrompt,
    prompt: userPrompt,
  })

  await prisma.aiResult.create({
    data: {
      leadId,
      actionType,
      prompt: userPrompt,
      result: text,
      model: AGENT_AI_CONFIG.model,
    },
  })

  if (usage?.inputTokens || usage?.outputTokens) {
    consumeTokenCredits(
      user.id,
      {
        provider: AGENT_AI_CONFIG.provider,
        model: AGENT_AI_CONFIG.model,
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
      },
      user.email
    ).catch(() => {})
  }
}

export async function runAgent(
  agent: AiAgent,
  user: AgentRunUser
): Promise<AgentRunResult> {
  const config = (agent.config ?? {}) as AgentConfig

  if (!config.searchType) {
    throw new AgentRunError("Agent has no searchType configured", { status: 400 })
  }

  try {
    getActorId(config.searchType)
  } catch {
    throw new AgentRunError(
      `Apify actor not configured for search type: ${config.searchType}. Check your .env file.`,
      { status: 503, code: "ACTOR_NOT_CONFIGURED" }
    )
  }

  await ensureAgentCredits(user)

  const searchType = config.searchType
  const searchParams: Record<string, unknown> = {
    ...config.searchParams,
    description: config.searchDescription,
    location: config.searchLocation,
    resultsLimit: config.resultsLimit ?? 10,
  }

  const searchHistory = await prisma.searchHistory.create({
    data: {
      userId: user.id,
      searchType,
      parameters: JSON.parse(JSON.stringify(searchParams)),
      status: "PENDING",
    },
  })

  try {
    await prisma.searchHistory.update({
      where: { id: searchHistory.id },
      data: { status: "RUNNING" },
    })

    const results = await executeSearch(searchType, searchParams)
    let listId = config.listId

    if (!listId) {
      const list = await prisma.leadList.create({
        data: {
          name: `${agent.name} - ${new Date().toLocaleDateString()}`,
          type: searchType,
          userId: user.id,
        },
      })
      listId = list.id
    }

    const leads = await Promise.all(
      results.map(async (leadData) => {
        const lead = await prisma.lead.create({
          data: {
            ...pickLeadFields(leadData),
            sourceType: searchType,
            emailStatus: leadData.email ? "FOUND" : "NOT_FOUND",
          },
        })

        await prisma.leadListEntry.create({
          data: { listId: listId!, leadId: lead.id },
        }).catch(() => {})

        return lead
      })
    )

    const actions = config.actions ?? []
    const actionErrors: Array<{ leadId: string; action: string; error: string }> = []

    for (const lead of leads) {
      if (actions.includes("enrich_email")) {
        try {
          const updated = await enrichEmail(lead.id)
          if (updated.emailStatus === "FOUND" || updated.emailStatus === "POTENTIAL") {
            deductAgentCredits(user.id, "enrich:email", 1, { leadId: lead.id })
          }
        } catch (err) {
          actionErrors.push({
            leadId: lead.id,
            action: "enrich_email",
            error: err instanceof Error ? err.message : "Unknown error",
          })
        }
      }

      if (actions.includes("enrich_phone")) {
        try {
          const updated = await enrichPhone(lead.id)
          if (updated.phoneStatus === "FOUND") {
            deductAgentCredits(user.id, "enrich:phone", 1, { leadId: lead.id })
          }
        } catch (err) {
          actionErrors.push({
            leadId: lead.id,
            action: "enrich_phone",
            error: err instanceof Error ? err.message : "Unknown error",
          })
        }
      }

      if (actions.includes("ai_summary")) {
        try {
          await saveAiResult(user, lead.id, "SUMMARY")
        } catch (err) {
          actionErrors.push({
            leadId: lead.id,
            action: "ai_summary",
            error: err instanceof Error ? err.message : "Unknown error",
          })
        }
      }

      if (actions.includes("ai_direct_message")) {
        try {
          await saveAiResult(user, lead.id, "DIRECT_MESSAGE")
        } catch (err) {
          actionErrors.push({
            leadId: lead.id,
            action: "ai_direct_message",
            error: err instanceof Error ? err.message : "Unknown error",
          })
        }
      }
    }

    const finalLeads = leads.length
      ? await prisma.lead.findMany({ where: { id: { in: leads.map((lead) => lead.id) } } })
      : []
    const webhookResults: Array<{ url: string; status: number | string }> = []

    if (config.connections && config.connections.length > 0) {
      const payload = {
        agentId: agent.id,
        agentName: agent.name,
        searchType,
        listId,
        leadCount: finalLeads.length,
        leads: finalLeads.map((lead) => ({
          id: lead.id,
          fullName: lead.fullName,
          email: lead.email,
          phone: lead.phone,
          companyName: lead.companyName,
          location: lead.location,
        })),
        executedAt: new Date().toISOString(),
      }

      for (const url of config.connections) {
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
          webhookResults.push({ url, status: res.status })
        } catch (err) {
          webhookResults.push({
            url,
            status: err instanceof Error ? err.message : "Failed",
          })
        }
      }
    }

    await prisma.searchHistory.update({
      where: { id: searchHistory.id },
      data: { status: "COMPLETED", resultCount: leads.length, listId },
    })

    deductAgentCredits(
      user.id,
      getSearchCreditAction(searchType),
      countBillableSearchResults(searchType, leads),
      { listId, searchType }
    )

    const updatedLeadCount = (config.leadCount ?? 0) + leads.length
    await prisma.aiAgent.update({
      where: { id: agent.id },
      data: {
        config: jsonConfig({
          ...config,
          listId,
          leadCount: updatedLeadCount,
        }),
      },
    })

    return {
      status: "completed",
      agentId: agent.id,
      searchId: searchHistory.id,
      listId,
      leadCount: leads.length,
      totalLeadCount: updatedLeadCount,
      actionsRun: actions,
      actionErrors: actionErrors.length > 0 ? actionErrors : undefined,
      webhookResults: webhookResults.length > 0 ? webhookResults : undefined,
    }
  } catch (error) {
    await prisma.searchHistory.update({
      where: { id: searchHistory.id },
      data: { status: "FAILED" },
    })

    if (error instanceof AgentRunError) {
      error.searchId = searchHistory.id
      throw error
    }

    const message = error instanceof Error ? error.message : "Agent execution failed"
    throw new AgentRunError(message, { status: 500, searchId: searchHistory.id })
  }
}

export function normalizeSchedule(value: unknown): AgentSchedule {
  if (value === "daily" || value === "weekly" || value === "monthly") return value
  return "manual"
}

export function getNextScheduledRunAt(schedule: unknown, from = new Date()) {
  const normalized = normalizeSchedule(schedule)
  const next = new Date(from)

  switch (normalized) {
    case "daily":
      next.setDate(next.getDate() + 1)
      return next.toISOString()
    case "weekly":
      next.setDate(next.getDate() + 7)
      return next.toISOString()
    case "monthly":
      next.setMonth(next.getMonth() + 1)
      return next.toISOString()
    case "manual":
    default:
      return null
  }
}

export function isScheduledAgentDue(config: AgentConfig, now = new Date()) {
  const schedule = normalizeSchedule(config.schedule)
  if (schedule === "manual") return false

  if (config.schedulerLockAt) {
    const lockAge = now.getTime() - new Date(config.schedulerLockAt).getTime()
    if (Number.isFinite(lockAge) && lockAge < 60 * 60 * 1000) return false
  }

  if (config.nextScheduledRunAt) {
    return new Date(config.nextScheduledRunAt).getTime() <= now.getTime()
  }

  if (!config.lastScheduledRunAt) return true

  const next = getNextScheduledRunAt(schedule, new Date(config.lastScheduledRunAt))
  return next ? new Date(next).getTime() <= now.getTime() : false
}

export function clearSchedulerLock(config: AgentConfig) {
  const nextConfig = { ...config }
  delete nextConfig.schedulerLockAt
  return nextConfig
}

export function serializeAgentConfig(config: AgentConfig) {
  return jsonConfig(config)
}
