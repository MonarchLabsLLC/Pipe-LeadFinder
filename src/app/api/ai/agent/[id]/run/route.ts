import { NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { ensureUser } from "@/lib/ensure-user"
import { guardCredits, deductCredits } from "@/lib/credit-guard"
import { pickLeadFields } from "@/lib/pick-lead-fields"
import { executeSearch, getActorId } from "@/services/search-service"
import { enrichEmail, enrichPhone } from "@/services/enrich-service"
import {
  consumeTokenCredits,
  type CreditAction,
} from "@/services/credits-service"
import {
  getBusinessContext,
  getLeadContext,
  buildSystemPrompt,
  buildUserPrompt,
} from "@/services/ai-service"
import type { SearchType } from "@/generated/prisma/enums"
import type { Lead } from "@/generated/prisma/client"

type RouteContext = { params: Promise<{ id: string }> }

const AGENT_AI_MODEL =
  process.env.OPENAI_AGENT_MODEL || process.env.OPENAI_MODEL || "gpt-5.4-nano"

// Agent config shape stored in the JSON config field
interface AgentConfig {
  searchType?: SearchType
  searchDescription?: string
  searchLocation?: string
  searchParams?: Record<string, unknown>
  actions?: string[]
  connections?: string[] // webhook URLs
  schedule?: string
  resultsLimit?: number
  listId?: string
  leadCount?: number
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

// POST /api/ai/agent/[id]/run — execute an agent run
export async function POST(_req: NextRequest, context: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  await ensureUser(session)

  const { id } = await context.params
  const agent = await prisma.aiAgent.findUnique({ where: { id } })

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 })
  }
  if (agent.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const config = (agent.config ?? {}) as AgentConfig

  // ---------------------------------------------------------------------------
  // Validate config
  // ---------------------------------------------------------------------------

  if (!config.searchType) {
    return NextResponse.json(
      { error: "Agent has no searchType configured" },
      { status: 400 }
    )
  }

  // Verify Apify actor env var is set for this search type
  try {
    getActorId(config.searchType)
  } catch {
    return NextResponse.json(
      {
        error: `Apify actor not configured for search type: ${config.searchType}. Check your .env file.`,
        code: "ACTOR_NOT_CONFIGURED",
      },
      { status: 503 }
    )
  }

  const blocked = await guardCredits(session.user.id, session.user.email)
  if (blocked) return blocked

  // ---------------------------------------------------------------------------
  // 1. Build search params from agent config
  // ---------------------------------------------------------------------------

  const searchParams: Record<string, unknown> = {
    ...config.searchParams,
    description: config.searchDescription,
    location: config.searchLocation,
    resultsLimit: config.resultsLimit ?? 10,
  }

  // ---------------------------------------------------------------------------
  // 2. Create a search history record
  // ---------------------------------------------------------------------------

  const searchHistory = await prisma.searchHistory.create({
    data: {
      userId: session.user.id,
      searchType: config.searchType,
      parameters: JSON.parse(JSON.stringify(searchParams)),
      status: "PENDING",
    },
  })

  try {
    await prisma.searchHistory.update({
      where: { id: searchHistory.id },
      data: { status: "RUNNING" },
    })

    // -------------------------------------------------------------------------
    // 3. Execute the search
    // -------------------------------------------------------------------------

    const results = await executeSearch(config.searchType, searchParams)

    // -------------------------------------------------------------------------
    // 4. Create or reuse a list for this agent run
    // -------------------------------------------------------------------------

    let listId = config.listId

    if (!listId) {
      const list = await prisma.leadList.create({
        data: {
          name: `${agent.name} — ${new Date().toLocaleDateString()}`,
          type: config.searchType,
          userId: session.user.id,
        },
      })
      listId = list.id
    }

    // -------------------------------------------------------------------------
    // 5. Save results as leads
    // -------------------------------------------------------------------------

    const leads = await Promise.all(
      results.map(async (leadData) => {
        const lead = await prisma.lead.create({
          data: {
            ...pickLeadFields(leadData),
            sourceType: config.searchType!,
            emailStatus: leadData.email ? "FOUND" : "NOT_FOUND",
          },
        })

        await prisma.leadListEntry.create({
          data: { listId: listId!, leadId: lead.id },
        }).catch(() => {}) // Ignore duplicate entries

        return lead
      })
    )

    // -------------------------------------------------------------------------
    // 6. Run configured actions
    // -------------------------------------------------------------------------

    const actions = config.actions ?? []
    const actionErrors: Array<{ leadId: string; action: string; error: string }> = []

    for (const lead of leads) {
      // Enrich email
      if (actions.includes("enrich_email")) {
        try {
          const updated = await enrichEmail(lead.id)
          if (updated.emailStatus === "FOUND" || updated.emailStatus === "POTENTIAL") {
            deductCredits(session.user.id, "enrich:email", 1, { leadId: lead.id })
          }
        } catch (err) {
          actionErrors.push({
            leadId: lead.id,
            action: "enrich_email",
            error: err instanceof Error ? err.message : "Unknown error",
          })
        }
      }

      // Enrich phone
      if (actions.includes("enrich_phone")) {
        try {
          const updated = await enrichPhone(lead.id)
          if (updated.phoneStatus === "FOUND") {
            deductCredits(session.user.id, "enrich:phone", 1, { leadId: lead.id })
          }
        } catch (err) {
          actionErrors.push({
            leadId: lead.id,
            action: "enrich_phone",
            error: err instanceof Error ? err.message : "Unknown error",
          })
        }
      }

      // AI Summary
      if (actions.includes("ai_summary")) {
        try {
          const [leadContext, businessContext] = await Promise.all([
            getLeadContext(lead.id),
            getBusinessContext(session.user.id),
          ])
          const systemPrompt = buildSystemPrompt("SUMMARY", businessContext)
          const userPrompt = buildUserPrompt("SUMMARY", leadContext)

          const { text, usage } = await generateText({
            model: openai(AGENT_AI_MODEL),
            system: systemPrompt,
            prompt: userPrompt,
          })

          await prisma.aiResult.create({
            data: {
              leadId: lead.id,
              actionType: "SUMMARY",
              prompt: userPrompt,
              result: text,
              model: AGENT_AI_MODEL,
            },
          })
          if (usage?.inputTokens || usage?.outputTokens) {
            consumeTokenCredits(session.user.id, {
              provider: "openai",
              model: AGENT_AI_MODEL,
              inputTokens: usage.inputTokens ?? 0,
              outputTokens: usage.outputTokens ?? 0,
            }, session.user.email).catch(() => {})
          }
        } catch (err) {
          actionErrors.push({
            leadId: lead.id,
            action: "ai_summary",
            error: err instanceof Error ? err.message : "Unknown error",
          })
        }
      }

      // AI Direct Message
      if (actions.includes("ai_direct_message")) {
        try {
          const [leadContext, businessContext] = await Promise.all([
            getLeadContext(lead.id),
            getBusinessContext(session.user.id),
          ])
          const systemPrompt = buildSystemPrompt("DIRECT_MESSAGE", businessContext)
          const userPrompt = buildUserPrompt("DIRECT_MESSAGE", leadContext)

          const { text, usage } = await generateText({
            model: openai(AGENT_AI_MODEL),
            system: systemPrompt,
            prompt: userPrompt,
          })

          await prisma.aiResult.create({
            data: {
              leadId: lead.id,
              actionType: "DIRECT_MESSAGE",
              prompt: userPrompt,
              result: text,
              model: AGENT_AI_MODEL,
            },
          })
          if (usage?.inputTokens || usage?.outputTokens) {
            consumeTokenCredits(session.user.id, {
              provider: "openai",
              model: AGENT_AI_MODEL,
              inputTokens: usage.inputTokens ?? 0,
              outputTokens: usage.outputTokens ?? 0,
            }, session.user.email).catch(() => {})
          }
        } catch (err) {
          actionErrors.push({
            leadId: lead.id,
            action: "ai_direct_message",
            error: err instanceof Error ? err.message : "Unknown error",
          })
        }
      }
    }

    // -------------------------------------------------------------------------
    // 7. Fire webhooks if connections are configured
    // -------------------------------------------------------------------------

    const webhookResults: Array<{ url: string; status: number | string }> = []

    if (config.connections && config.connections.length > 0) {
      const payload = {
        agentId: agent.id,
        agentName: agent.name,
        searchType: config.searchType,
        listId,
        leadCount: leads.length,
        leads: leads.map((l) => ({
          id: l.id,
          fullName: l.fullName,
          email: l.email,
          phone: l.phone,
          companyName: l.companyName,
          location: l.location,
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

    // -------------------------------------------------------------------------
    // 8. Update search history and agent config with lead count
    // -------------------------------------------------------------------------

    await prisma.searchHistory.update({
      where: { id: searchHistory.id },
      data: { status: "COMPLETED", resultCount: leads.length, listId },
    })

    const billableSearchResults = countBillableSearchResults(config.searchType, leads)
    deductCredits(
      session.user.id,
      getSearchCreditAction(config.searchType),
      billableSearchResults,
      { listId, searchType: config.searchType }
    )

    const updatedLeadCount = (config.leadCount ?? 0) + leads.length
    await prisma.aiAgent.update({
      where: { id: agent.id },
      data: {
        config: JSON.parse(JSON.stringify({
          ...config,
          listId,
          leadCount: updatedLeadCount,
        })),
      },
    })

    // -------------------------------------------------------------------------
    // 9. Return results
    // -------------------------------------------------------------------------

    return NextResponse.json({
      status: "completed",
      agentId: agent.id,
      searchId: searchHistory.id,
      listId,
      leadCount: leads.length,
      totalLeadCount: updatedLeadCount,
      actionsRun: actions,
      actionErrors: actionErrors.length > 0 ? actionErrors : undefined,
      webhookResults: webhookResults.length > 0 ? webhookResults : undefined,
    })
  } catch (error) {
    await prisma.searchHistory.update({
      where: { id: searchHistory.id },
      data: { status: "FAILED" },
    })

    const message = error instanceof Error ? error.message : "Agent execution failed"

    return NextResponse.json(
      { error: message, searchId: searchHistory.id },
      { status: 500 }
    )
  }
}
