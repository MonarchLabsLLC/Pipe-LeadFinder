import { NextRequest } from "next/server"
import { streamText } from "ai"
import { openai } from "@ai-sdk/openai"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { AiActionType } from "@/generated/prisma/enums"
import {
  getBusinessContext,
  getLeadContext,
  buildSystemPrompt,
  buildUserPrompt,
} from "@/services/ai-service"
import { consumeTokenCredits } from "@/services/credits-service"

const VALID_ACTION_TYPES: AiActionType[] = [
  "SIMILAR_PEOPLE",
  "DIRECT_MESSAGE",
  "SUMMARY",
  "SUBJECT_LINE",
  "INTRO",
  "CUSTOM",
  "LIBRARY",
]

export async function POST(request: NextRequest) {
  // 1. Auth check
  const session = await auth()
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  // 2. Parse body
  let body: { leadId: string; actionType: AiActionType; customPrompt?: string }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const { leadId, actionType, customPrompt } = body

  if (!leadId || !actionType) {
    return new Response(
      JSON.stringify({ error: "leadId and actionType are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }

  if (!VALID_ACTION_TYPES.includes(actionType)) {
    return new Response(
      JSON.stringify({ error: `Invalid actionType: ${actionType}` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }

  // 3. Load contexts
  let leadContext: string
  let businessContext: string
  try {
    ;[leadContext, businessContext] = await Promise.all([
      getLeadContext(leadId),
      getBusinessContext(session.user.id),
    ])
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load context"
    return new Response(JSON.stringify({ error: message }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })
  }

  // 4. Build prompts
  const systemPrompt = buildSystemPrompt(actionType, businessContext)
  const userPrompt = buildUserPrompt(actionType, leadContext, customPrompt)

  // 5. Stream with OpenAI
  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: systemPrompt,
    prompt: userPrompt,
    onFinish: async ({ text, usage }) => {
      // 6. Save result to AiResult table
      try {
        await prisma.aiResult.create({
          data: {
            leadId,
            actionType,
            prompt: customPrompt || userPrompt,
            result: text,
            model: "gpt-4o-mini",
          },
        })
      } catch (err) {
        console.error("Failed to save AI result:", err)
      }

      // 7. Consume token-based credits (fire-and-forget)
      if (usage?.inputTokens || usage?.outputTokens) {
        consumeTokenCredits(session.user.id, {
          provider: "openai",
          model: "gpt-4o-mini",
          inputTokens: usage.inputTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
        }, session.user.email).catch(() => {})
      }
    },
  })

  // 7. Return streaming response
  return result.toTextStreamResponse()
}
