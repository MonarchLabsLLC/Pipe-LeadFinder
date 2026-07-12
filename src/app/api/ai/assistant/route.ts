import { NextRequest } from "next/server"
import { streamText } from "ai"
import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { AiActionType } from "@/generated/prisma/enums"
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
import { consumeTokenCredits } from "@/services/credits-service"
import { guardCredits } from "@/lib/credit-guard"

const ASSISTANT_AI_CONFIG = getAiRuntimeConfig("assistant")

const VALID_ACTION_TYPES: AiActionType[] = [
  "SIMILAR_PEOPLE",
  "DIRECT_MESSAGE",
  "SUMMARY",
  "SUBJECT_LINE",
  "INTRO",
  "CUSTOM",
  "LIBRARY",
]

const assistantRequestSchema = z
  .object({
    leadId: z.string().trim().min(1).max(200),
    actionType: z.enum(VALID_ACTION_TYPES as [AiActionType, ...AiActionType[]]),
    customPrompt: z.string().trim().min(1).max(20_000).optional(),
  })
  .superRefine((value, context) => {
    if (
      (value.actionType === "CUSTOM" || value.actionType === "LIBRARY") &&
      !value.customPrompt
    ) {
      context.addIssue({
        code: "custom",
        path: ["customPrompt"],
        message: "A prompt is required for this action",
      })
    }
  })

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
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const parsed = assistantRequestSchema.safeParse(rawBody)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: "Invalid AI assistant request",
        details: parsed.error.flatten(),
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }
  const { leadId, actionType, customPrompt } = parsed.data

  const blocked = await guardCredits(session.user.id, session.user.email)
  if (blocked) return blocked

  // 3. Load contexts
  let leadContext: string
  let businessContext: string
  try {
    ;[leadContext, businessContext] = await Promise.all([
      getLeadContext(leadId, session.user.id),
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

  // 5. Stream with the configured AI provider
  const result = streamText({
    model: getAiLanguageModel(ASSISTANT_AI_CONFIG),
    system: systemPrompt,
    prompt: userPrompt,
    maxOutputTokens: 1_500,
    onFinish: async ({ text, usage }) => {
      const operations: Promise<unknown>[] = [
        prisma.aiResult.create({
          data: {
            leadId,
            actionType,
            prompt: customPrompt || userPrompt,
            result: text,
            model: ASSISTANT_AI_CONFIG.model,
          },
        }),
      ]

      if (usage?.inputTokens || usage?.outputTokens) {
        operations.push(
          consumeTokenCredits(
            session.user.id,
            {
              provider: ASSISTANT_AI_CONFIG.provider,
              model: ASSISTANT_AI_CONFIG.model,
              inputTokens: usage.inputTokens ?? 0,
              outputTokens: usage.outputTokens ?? 0,
            },
            session.user.email
          )
        )
      }

      const settled = await Promise.allSettled(operations)
      for (const operation of settled) {
        if (operation.status === "rejected") {
          console.error("Failed to finalize AI assistant operation", operation.reason)
        }
      }
    },
  })

  // 7. Return streaming response
  return result.toTextStreamResponse()
}
