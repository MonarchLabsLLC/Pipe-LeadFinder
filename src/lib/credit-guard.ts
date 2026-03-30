/**
 * Credit guard helpers for API routes.
 * Pre-check before an operation + post-consume after success.
 */

import { NextResponse } from "next/server"
import {
  ensureCreditsAvailable,
  consumeCredits,
  CREDIT_COSTS,
  type CreditAction,
} from "@/services/credits-service"

/**
 * Pre-check: ensure user has credits before running a search/enrichment.
 * Returns a NextResponse error if blocked, or null if OK to proceed.
 */
export async function guardCredits(
  userId: string,
  email?: string | null
): Promise<NextResponse | null> {
  const check = await ensureCreditsAvailable(userId, email)
  if (!check.ok) {
    return NextResponse.json(
      {
        error: check.message || "Insufficient credits",
        code: "INSUFFICIENT_CREDITS",
        purchaseUrl:
          process.env.SCALECREDITS_URL || "https://credits.scaleplus.gg",
      },
      { status: check.status || 402 }
    )
  }
  return null // OK to proceed
}

/**
 * Post-operation: consume credits after a successful action.
 * Fire-and-forget — never blocks the response.
 */
export function deductCredits(
  userId: string,
  action: CreditAction,
  resultCount: number,
  meta?: { listId?: string; leadId?: string; searchType?: string }
) {
  const perUnit = CREDIT_COSTS[action]
  const total = perUnit * resultCount
  if (total <= 0) return

  // Fire-and-forget
  consumeCredits(userId, {
    amount: total,
    description: `${action} × ${resultCount}`,
    metadata: {
      action,
      resultCount,
      ...meta,
    },
  }).catch((err) => {
    console.error("[CreditGuard] Deduction failed:", err)
  })
}
