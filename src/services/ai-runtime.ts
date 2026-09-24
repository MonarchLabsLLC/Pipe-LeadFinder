import {
  createOpenRouter,
  type OpenRouterProviderOptions,
} from "@openrouter/ai-sdk-provider"

/**
 * One AI runtime for every Lead Finder feature (assistant, Agent, scoring,
 * "Describe who you want"). It mirrors the ClickCampaigns OpenRouter setup:
 * same base URL, same key variables, same attribution headers, DeepSeek V4.1
 * Flash with the V4 Flash 0731 fallback, reasoning switched off for these
 * short structured tasks. Generation, stored result metadata and ScaleCredits
 * token billing all read the model from here so they cannot drift apart.
 */

export type AiRuntimeFeature = "assistant" | "agent" | "scoring" | "search-interpret"
export type AiProviderName = "openrouter"

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1" as const
export const OPENROUTER_TEXT_MODEL = "deepseek/deepseek-v4.1-flash" as const
export const OPENROUTER_TEXT_FALLBACK_MODELS = ["deepseek/deepseek-v4-flash-0731"] as const
export const OPENROUTER_APP_TITLE = "PipeLeads Lead Finder" as const
const DEFAULT_APP_URL = "https://leadfinder.pipeleads.ai"

/** @deprecated kept for callers that only need the default model id. */
export const PIPELEADS_AI_MODEL = OPENROUTER_TEXT_MODEL

export interface AiRuntimeConfig {
  provider: AiProviderName
  /** Primary model, from LEADFINDER_AI_MODEL or DeepSeek V4.1 Flash. */
  model: string
  /** Tried in order by OpenRouter when the primary model is unavailable. */
  fallbackModels: readonly string[]
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super("OPEN_ROUTER_API_KEY or OPENROUTER_API_KEY is not configured")
    this.name = "AiNotConfiguredError"
  }
}

export function getOpenRouterApiKey(): string | undefined {
  return process.env.OPEN_ROUTER_API_KEY || process.env.OPENROUTER_API_KEY || undefined
}

function configuredModel(): string {
  const fromEnv = process.env.LEADFINDER_AI_MODEL?.trim()
  return fromEnv || OPENROUTER_TEXT_MODEL
}

export function getAiRuntimeConfig(feature: AiRuntimeFeature): AiRuntimeConfig {
  void feature
  const model = configuredModel()
  return {
    provider: "openrouter",
    model,
    fallbackModels: OPENROUTER_TEXT_FALLBACK_MODELS.filter((m) => m !== model),
  }
}

export function getAiLanguageModel(config: AiRuntimeConfig) {
  const apiKey = getOpenRouterApiKey()
  if (!apiKey) throw new AiNotConfiguredError()
  const provider = createOpenRouter({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    compatibility: "strict",
    appName: OPENROUTER_APP_TITLE,
    appUrl:
      process.env.OPENROUTER_HTTP_REFERER ||
      process.env.BASE_URL ||
      process.env.AUTH_URL ||
      DEFAULT_APP_URL,
  })
  return provider.chat(config.model, {
    // OpenRouter falls through this list server-side when the primary fails.
    ...(config.fallbackModels.length
      ? { models: [config.model, ...config.fallbackModels] }
      : {}),
    // Same as ClickCampaigns' non-"high" roles: no paid reasoning tokens.
    reasoning: { enabled: false, exclude: true } as OpenRouterProviderOptions["reasoning"],
    // Only route to hosts that honour json_schema / tools when we send them.
    provider: { require_parameters: true, allow_fallbacks: true },
    usage: { include: true },
  })
}

/**
 * The model to bill and record. OpenRouter reports the model that actually
 * answered (the fallback when it was used, sometimes with a dated suffix);
 * anything we do not recognise bills as the configured primary model.
 */
export function resolveBilledModel(
  config: AiRuntimeConfig,
  responseModelId?: string | null
): string {
  const candidates = [config.model, ...config.fallbackModels]
  if (!responseModelId) return config.model
  const exact = candidates.find((m) => m === responseModelId)
  if (exact) return exact
  const prefixed = candidates
    .filter((m) => responseModelId.startsWith(`${m}-`) || responseModelId.startsWith(`${m}:`))
    .sort((a, b) => b.length - a.length)[0]
  return prefixed ?? config.model
}

/**
 * A log-safe description of a provider failure: never the request, headers or
 * key, only the error class, HTTP status and a truncated, redacted message.
 */
export function describeAiError(error: unknown): Record<string, unknown> {
  const e = error as { name?: string; message?: string; statusCode?: number; cause?: unknown }
  const message = String(e?.message ?? error ?? "unknown error")
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, "[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .slice(0, 300)
  return {
    provider: "openrouter",
    name: e?.name ?? "Error",
    ...(typeof e?.statusCode === "number" ? { statusCode: e.statusCode } : {}),
    message,
  }
}
