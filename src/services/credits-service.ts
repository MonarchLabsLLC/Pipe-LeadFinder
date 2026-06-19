/**
 * Credits Service — server-side proxy to ScaleCredits microservice
 *
 * Uses internal webhook auth (x-internal-webhook + x-user-id) since
 * PipeLeads uses NextAuth Credentials, not Keycloak Bearer tokens.
 *
 * Adapted from ClickCampaigns/PageBuilder patterns for Next.js.
 */

import type {
  CreditBalance,
  CreditCheckResult,
  CreditUsagePayload,
  ConsumeCreditsResponse,
  TokenUsagePayload,
} from "@/types/credits"
import { prisma } from "@/lib/prisma"
import {
  CREDIT_COSTS,
  CREDIT_DISPLAY_SCALE,
  PIPELEADS_PRICING_MODELS,
  type PipeLeadsCreditAction,
  type PipeLeadsPricingItem,
} from "@/lib/pipeleads-credit-pricing"

const MICRO_SERVICE_BASE =
  process.env.MICRO_SERVICE_BASE || "http://localhost:3002/api"
const APP_NAME = process.env.SCALECREDITS_APP_NAME || "PipeLeads"
const SCALECREDITS_URL =
  process.env.SCALECREDITS_URL || "https://credits.scaleplus.gg"

const DEFAULT_TIMEOUT_MS = 10_000
const MAX_RETRIES = 3
const RETRY_BASE_DELAY_MS = 1_000
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = MAX_RETRIES,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fetchWithTimeout(url, options, timeoutMs)
    } catch (error: unknown) {
      lastError = error as Error
      if (attempt === retries - 1) break
      console.warn(
        `[Credits] Attempt ${attempt + 1}/${retries} failed:`,
        (error as Error).name === "AbortError"
          ? "Timeout"
          : (error as Error).message
      )
      await new Promise((r) =>
        setTimeout(r, RETRY_BASE_DELAY_MS * 2 ** attempt)
      )
    }
  }
  throw lastError ?? new Error("Fetch failed after retries")
}

/** Build internal service-to-service headers for the microservice */
function internalHeaders(
  creditUserId: string,
  email?: string | null
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-internal-webhook": "true",
    "x-user-id": creditUserId,
    "x-app-name": APP_NAME,
  }
  if (email) headers["x-user-email"] = email
  return headers
}

async function resolveCreditUserId(userId: string): Promise<string | null> {
  if (UUID_PATTERN.test(userId)) return userId

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { keycloakSubId: true },
  })

  const keycloakSubId = user?.keycloakSubId
  if (keycloakSubId && UUID_PATTERN.test(keycloakSubId)) return keycloakSubId

  console.warn("[Credits] User is missing a Keycloak UUID for billing", {
    userId,
    hasKeycloakSubId: Boolean(keycloakSubId),
  })
  return null
}

function isCreditAction(value: unknown): value is PipeLeadsCreditAction {
  return typeof value === "string" && value in PIPELEADS_PRICING_MODELS
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Get a user's credit balance */
export async function getBalance(
  userId: string,
  email?: string | null
): Promise<CreditBalance | null> {
  if (!MICRO_SERVICE_BASE) return null
  const creditUserId = await resolveCreditUserId(userId)
  if (!creditUserId) return null

  try {
    const res = await fetchWithRetry(`${MICRO_SERVICE_BASE}/credits/me`, {
      headers: internalHeaders(creditUserId, email),
    })
    if (!res.ok) return null
    return (await res.json()) as CreditBalance
  } catch {
    return null
  }
}

/**
 * Pre-operation credit check.
 * Blocks only when balance is already negative (grace period allows one negative op).
 */
export async function ensureCreditsAvailable(
  userId: string,
  email?: string | null
): Promise<CreditCheckResult> {
  if (!MICRO_SERVICE_BASE) {
    return {
      ok: true,
      balance: {
        userId: "",
        availableCredits: Infinity,
        consumedCredits: 0,
        updatedAt: null,
      },
    }
  }

  const creditUserId = await resolveCreditUserId(userId)
  if (!creditUserId) {
    if (process.env.NODE_ENV !== "production" || process.env.DEV_AUTO_LOGIN === "true") {
      return {
        ok: true,
        balance: {
          userId,
          availableCredits: Infinity,
          consumedCredits: 0,
          updatedAt: null,
        },
      }
    }

    return {
      ok: false,
      status: 500,
      message: "Your account is not linked to a ScaleCredits billing identity. Please sign out and back in, then try again.",
    }
  }

  try {
    const res = await fetchWithRetry(`${MICRO_SERVICE_BASE}/credits/me`, {
      headers: internalHeaders(creditUserId, email),
    })

    if (!res.ok) {
      if (res.status === 401)
        return { ok: false, status: 401, message: "Unauthorized" }
      return {
        ok: false,
        status: 500,
        message: "Failed to verify credit balance",
      }
    }

    const balance = (await res.json()) as CreditBalance
    if (balance.availableCredits < 0) {
      return {
        ok: false,
        status: 402,
        message: `Your credit balance is negative. Please add credits at ${SCALECREDITS_URL} to continue.`,
        balance,
      }
    }

    return { ok: true, balance }
  } catch {
    return {
      ok: false,
      status: 503,
      message: "Credit service temporarily unavailable",
    }
  }
}

/** Get PipeLeads per-hit pricing from the microservice. */
export async function getPipeLeadsPricing(): Promise<
  PipeLeadsPricingItem[] | null
> {
  if (!MICRO_SERVICE_BASE) return null

  try {
    const res = await fetchWithRetry(
      `${MICRO_SERVICE_BASE}/pricing/pipeleads`,
      {
        headers: {
          "Content-Type": "application/json",
          "x-internal-webhook": "true",
          "x-user-id": "pipeleads-pricing",
          "x-app-name": APP_NAME,
        },
      },
      1,
      5_000
    )
    if (!res.ok) return null
    const data = (await res.json()) as { items?: PipeLeadsPricingItem[] }
    return Array.isArray(data.items) ? data.items : null
  } catch (error) {
    console.warn(
      "[Credits] Failed to load PipeLeads pricing:",
      (error as Error).message
    )
    return null
  }
}

/**
 * Consume credits after a successful operation.
 * Fire-and-forget — logs errors but never throws.
 */
export async function consumeCredits(
  userId: string,
  usage: CreditUsagePayload,
  email?: string | null
): Promise<ConsumeCreditsResponse | null> {
  if (!MICRO_SERVICE_BASE) return null
  const creditUserId = await resolveCreditUserId(userId)
  if (!creditUserId) return null

  const displayAmount = usage.amount
  const action = isCreditAction(usage.metadata?.action)
    ? usage.metadata.action
    : null
  const resultCount = Math.max(Number(usage.metadata?.resultCount ?? 1), 1)
  const usageBody = action
    ? {
        provider: "pipeleads",
        model: PIPELEADS_PRICING_MODELS[action],
        hitCount: resultCount,
        description: usage.description,
        metadata: {
          ...usage.metadata,
          fallbackDisplayCredits: displayAmount,
        },
      }
    : {
        provider: "pipeleads",
        model: "pipeleads.fixed-usage",
        fixedCredits: displayAmount * CREDIT_DISPLAY_SCALE,
        description: usage.description,
        metadata: {
          ...usage.metadata,
          displayCredits: displayAmount,
        },
      }

  try {
    const res = await fetchWithRetry(
      `${MICRO_SERVICE_BASE}/credits/consume`,
      {
        method: "POST",
        headers: internalHeaders(creditUserId, email),
        body: JSON.stringify(usageBody),
      },
      MAX_RETRIES,
      15_000
    )

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      console.error("[Credits] Failed to consume:", errData)
      return {
        success: false,
        debited: 0,
        availableCredits: 0,
        error: String(errData.error),
      }
    }

    const result = (await res.json()) as CreditBalance & {
      debited?: number
      consumedCredits?: number
    }
    const debited = typeof result.debited === "number" ? result.debited : displayAmount
    console.log("[Credits] Consumed:", {
      debited,
      remaining: result.availableCredits,
    })
    return {
      success: true,
      debited,
      availableCredits: result.availableCredits,
      consumedCredits: result.consumedCredits,
    }
  } catch (error) {
    console.error("[Credits] Consume error:", (error as Error).message)
    return null
  }
}

/**
 * Consume credits for AI token usage (OpenAI, Gemini, etc.)
 * Fire-and-forget — the microservice calculates the credit cost from tokens.
 */
export async function consumeTokenCredits(
  userId: string,
  usage: TokenUsagePayload,
  email?: string | null
): Promise<ConsumeCreditsResponse | null> {
  if (!MICRO_SERVICE_BASE) return null
  const creditUserId = await resolveCreditUserId(userId)
  if (!creditUserId) return null

  try {
    const res = await fetchWithRetry(
      `${MICRO_SERVICE_BASE}/credits/consume`,
      {
        method: "POST",
        headers: internalHeaders(creditUserId, email),
        body: JSON.stringify({
          ...usage,
          appName: APP_NAME,
        }),
      },
      MAX_RETRIES,
      15_000
    )

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      console.error("[Credits] Token consume failed:", errData)
      return null
    }

    const result = (await res.json()) as ConsumeCreditsResponse
    console.log("[Credits] AI tokens consumed:", {
      provider: usage.provider,
      model: usage.model,
      input: usage.inputTokens,
      output: usage.outputTokens,
      debited: result.debited,
    })
    return { ...result, success: true }
  } catch (error) {
    console.error("[Credits] Token consume error:", (error as Error).message)
    return null
  }
}

// ---------------------------------------------------------------------------
// Credit cost constants for PipeLeads actions
// ---------------------------------------------------------------------------

export { CREDIT_COSTS }

export type CreditAction = PipeLeadsCreditAction
