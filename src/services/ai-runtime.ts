import { google } from "@ai-sdk/google"
import { openai } from "@ai-sdk/openai"

export type AiRuntimeFeature = "assistant" | "agent" | "scoring"
export type AiProviderName = "openai" | "google"

export interface AiRuntimeConfig {
  provider: AiProviderName
  model: string
}

const DEFAULT_OPENAI_MODEL = "gpt-5.4-nano"
const DEFAULT_GOOGLE_MODEL = "gemini-3-flash-preview"

const FEATURE_ENV_PREFIX: Record<AiRuntimeFeature, string> = {
  assistant: "ASSISTANT",
  agent: "AGENT",
  scoring: "SCORING",
}

function normalizeProvider(value?: string | null): AiProviderName {
  const provider = value?.trim().toLowerCase()
  if (provider === "google" || provider === "gemini") return "google"
  return "openai"
}

function providerForFeature(feature: AiRuntimeFeature): AiProviderName {
  const prefix = FEATURE_ENV_PREFIX[feature]
  const configuredProvider =
    process.env[`PIPELEADS_${prefix}_AI_PROVIDER`] ||
    process.env[`${prefix}_AI_PROVIDER`] ||
    process.env.PIPELEADS_AI_PROVIDER ||
    process.env.AI_PROVIDER

  if (configuredProvider) return normalizeProvider(configuredProvider)

  const hasFeatureGeminiModel =
    process.env[`GEMINI_${prefix}_MODEL`] || process.env[`GOOGLE_${prefix}_MODEL`]
  if (hasFeatureGeminiModel) return "google"

  return "openai"
}

function openAiModelForFeature(feature: AiRuntimeFeature) {
  const prefix = FEATURE_ENV_PREFIX[feature]
  return (
    process.env[`OPENAI_${prefix}_MODEL`] ||
    process.env.OPENAI_MODEL ||
    DEFAULT_OPENAI_MODEL
  )
}

function googleModelForFeature(feature: AiRuntimeFeature) {
  const prefix = FEATURE_ENV_PREFIX[feature]
  return (
    process.env[`GEMINI_${prefix}_MODEL`] ||
    process.env[`GOOGLE_${prefix}_MODEL`] ||
    process.env.GEMINI_MODEL ||
    process.env.GOOGLE_MODEL ||
    DEFAULT_GOOGLE_MODEL
  )
}

export function getAiRuntimeConfig(
  feature: AiRuntimeFeature
): AiRuntimeConfig {
  const provider = providerForFeature(feature)
  return {
    provider,
    model:
      provider === "google"
        ? googleModelForFeature(feature)
        : openAiModelForFeature(feature),
  }
}

export function getAiLanguageModel(config: AiRuntimeConfig) {
  return config.provider === "google"
    ? google(config.model)
    : openai(config.model)
}
