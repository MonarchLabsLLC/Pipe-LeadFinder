import { openai } from "@ai-sdk/openai"

export type AiRuntimeFeature = "assistant" | "agent" | "scoring"
export type AiProviderName = "openai"

export interface AiRuntimeConfig {
  provider: AiProviderName
  model: "gpt-5.4-nano"
}

export const PIPELEADS_AI_MODEL = "gpt-5.4-nano" as const

/**
 * PipeLeads intentionally uses one model for every AI feature so generation,
 * stored result metadata, and ScaleCredits token billing cannot drift apart.
 */
export function getAiRuntimeConfig(
  feature: AiRuntimeFeature
): AiRuntimeConfig {
  void feature
  return {
    provider: "openai",
    model: PIPELEADS_AI_MODEL,
  }
}

export function getAiLanguageModel(config: AiRuntimeConfig) {
  return openai(config.model)
}
