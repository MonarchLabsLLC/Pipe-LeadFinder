import { NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { ensureUser } from "@/lib/ensure-user"
import { pickLeadFields } from "@/lib/pick-lead-fields"
import { executeSearch, getActorId } from "@/services/search-service"
import { enrichEmail, enrichPhone } from "@/services/enrich-service"
import {
  getBusinessContext,
  getLeadContext,
  buildSystemPrompt,
  buildUserPrompt,
} from "@/services/ai-service"
import type { SearchType } from "@/generated/prisma/enums"

type RouteContext = { params: Promise<{ id: string }> }

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
          await enrichEmail(lead.id)
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
          await enrichPhone(lead.id)
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

          const { text } = await generateText({
            model: openai("gpt-4o-mini"),
            system: systemPrompt,
            prompt: userPrompt,
          })

          await prisma.aiResult.create({
            data: {
              leadId: lead.id,
              actionType: "SUMMARY",
              prompt: userPrompt,
              result: text,
              model: "gpt-4o-mini",
            },
          })
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

          const { text } = await generateText({
            model: openai("gpt-4o-mini"),
            system: systemPrompt,
            prompt: userPrompt,
          })

          await prisma.aiResult.create({
            data: {
              leadId: lead.id,
              actionType: "DIRECT_MESSAGE",
              prompt: userPrompt,
              result: text,
              model: "gpt-4o-mini",
            },
          })
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
