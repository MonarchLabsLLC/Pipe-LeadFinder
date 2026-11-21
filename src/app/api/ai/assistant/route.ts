import { randomUUID } from "node:crypto"
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
  describeAiError,
  getAiLanguageModel,
  getAiRuntimeConfig,
  resolveBilledModel,
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

  // 5. Stream with the configured AI provider (OpenRouter)
  let model: ReturnType<typeof getAiLanguageModel>
  try {
    model = getAiLanguageModel(ASSISTANT_AI_CONFIG)
  } catch (error) {
    console.error("[AiAssistant] Provider unavailable:", describeAiError(error))
    return new Response(
      JSON.stringify({ error: "The AI assistant is unavailable right now. Please try again later." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    )
  }

  // One key per provider call: onFinish and onError share it, so a call is
  // charged at most once.
  const userId = session.user.id
  const email = session.user.email
  const chargeKey = `PipeLeads:assistant:${randomUUID()}`
  let charged = false
  let streamedChars = 0

  const charge = async (
    billedModel: string,
    inputTokens: number,
    outputTokens: number,
    extra: Record<string, unknown> = {}
  ) => {
    if (charged || (inputTokens <= 0 && outputTokens <= 0)) return
    charged = true
    await consumeTokenCredits(
      userId,
      {
        provider: ASSISTANT_AI_CONFIG.provider,
        model: billedModel,
        inputTokens,
        outputTokens,
        description: `Lead Finder AI assistant (${actionType})`,
        metadata: { feature: "assistant", actionType, leadId, ...extra },
        idempotencyKey: chargeKey,
      },
      email
    )
  }

  const result = streamText({
    model,
    system: systemPrompt,
    prompt: userPrompt,
    maxOutputTokens: 1_500,
    onChunk: ({ chunk }) => {
      if (chunk.type === "text-delta") streamedChars += chunk.text.length
    },
    onError: async ({ error }) => {
      console.error("[AiAssistant] Generation failed:", describeAiError(error))
      // The provider reports usage only when the stream completes. If it broke
      // after producing output, the call still cost us: charge an estimate.
      if (streamedChars > 0) {
        try {
          await charge(
            ASSISTANT_AI_CONFIG.model,
            Math.ceil((systemPrompt.length + userPrompt.length) / 4),
            Math.ceil(streamedChars / 4),
            { estimatedUsage: true, reason: "stream_error" }
          )
        } catch (billingError) {
          console.error("[AiAssistant] Failed to charge a broken stream", billingError)
        }
      }
    },
    onFinish: async ({ text, usage, response }) => {
      const billedModel = resolveBilledModel(ASSISTANT_AI_CONFIG, response?.modelId)
      const settled = await Promise.allSettled([
        charge(billedModel, usage?.inputTokens ?? 0, usage?.outputTokens ?? 0),
        prisma.aiResult.create({
          data: {
            leadId,
            actionType,
            prompt: customPrompt || userPrompt,
            result: text,
            model: billedModel,
          },
        }),
      ])
      for (const operation of settled) {
        if (operation.status === "rejected") {
          console.error("Failed to finalize AI assistant operation", operation.reason)
        }
      }
    },
  })

  // Keep reading the provider stream server-side even if the browser
  // disconnects, so onFinish always runs and the usage is charged.
  void result.consumeStream({
    onError: (error) => {
      console.error("[AiAssistant] Background stream read failed:", describeAiError(error))
    },
  })

  // 7. Return streaming response
  return result.toTextStreamResponse()
}
