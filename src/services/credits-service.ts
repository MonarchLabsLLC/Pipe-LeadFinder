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

const MICRO_SERVICE_BASE =
  process.env.MICRO_SERVICE_BASE || "http://localhost:3002/api"
const APP_NAME = "pipe-leadfinder"
const SCALECREDITS_URL =
  process.env.SCALECREDITS_URL || "https://credits.scaleplus.gg"

const DEFAULT_TIMEOUT_MS = 10_000
const MAX_RETRIES = 3
const RETRY_BASE_DELAY_MS = 1_000

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
  userId: string,
  email?: string | null
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-internal-webhook": "true",
    "x-user-id": userId,
    "x-app-name": APP_NAME,
  }
  if (email) headers["x-user-email"] = email
  return headers
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
  try {
    const res = await fetchWithRetry(`${MICRO_SERVICE_BASE}/credits/me`, {
      headers: internalHeaders(userId, email),
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

  try {
    const res = await fetchWithRetry(`${MICRO_SERVICE_BASE}/credits/me`, {
      headers: internalHeaders(userId, email),
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

  try {
    const res = await fetchWithRetry(
      `${MICRO_SERVICE_BASE}/credits/consume`,
      {
        method: "POST",
        headers: internalHeaders(userId, email),
        body: JSON.stringify({
          amount: usage.amount,
          description: usage.description,
          metadata: { ...usage.metadata, appName: APP_NAME },
        }),
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

    const result = (await res.json()) as ConsumeCreditsResponse
    console.log("[Credits] Consumed:", {
      debited: result.debited,
      remaining: result.availableCredits,
    })
    return { ...result, success: true }
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

  try {
    const res = await fetchWithRetry(
      `${MICRO_SERVICE_BASE}/credits/consume`,
      {
        method: "POST",
        headers: internalHeaders(userId, email),
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

export const CREDIT_COSTS = {
  "search:people": 3, // per contact
  "search:local": 1, // per business (free if no email)
  "search:company": 1, // per company
  "search:domain": 1, // per contact
  "search:influencer": 2, // per profile
  "enrich:email": 1, // per lead
  "enrich:phone": 1, // per lead
} as const

export type CreditAction = keyof typeof CREDIT_COSTS
