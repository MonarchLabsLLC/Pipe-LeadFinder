import { prisma } from "@/lib/prisma"
import {
  getBalance,
  getPipeLeadsPricing,
  consumeTokenCredits,
  consumeCredits,
} from "@/services/credits-service"
import { getAiRuntimeConfig } from "@/services/ai-runtime"
import type { PipeLeadsCreditAction } from "@/lib/pipeleads-credit-pricing"
import { FocusedAgentError, trustedServiceUrl } from "./security"
import type { AgentActor } from "./access"

function configured() {
  if (!process.env.MICRO_SERVICE_BASE || !process.env.INTERNAL_WEBHOOK_SECRET)
    throw new FocusedAgentError(
      "BILLING_NOT_CONFIGURED",
      "Scale Credits must be configured before using the Agent.",
      503
    )
  trustedServiceUrl(process.env.MICRO_SERVICE_BASE, "/")
}
export async function requireCredits(a: AgentActor, minimum = 0) {
  configured()
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      a.subject
    )
  )
    throw new FocusedAgentError(
      "BILLING_IDENTITY_REQUIRED",
      "Your Keycloak billing identity must be linked before using paid operations.",
      503
    )
  const balance = await getBalance(a.userId, a.email)
  if (!balance || !Number.isFinite(balance.availableCredits))
    throw new FocusedAgentError(
      "BILLING_UNAVAILABLE",
      "Current Scale Credits could not be verified.",
      503,
      true
    )
  if (balance.availableCredits <= 0 || balance.availableCredits < minimum)
    throw new FocusedAgentError(
      "INSUFFICIENT_CREDITS",
      `This operation requires up to ${minimum || "available"} Scale Credits. Add credits first.`,
      402
    )
  return balance.availableCredits
}
export async function currentPrice(
  action: PipeLeadsCreditAction,
  maximumUnits: number
) {
  configured()
  const rows = await getPipeLeadsPricing()
  const price = rows?.find((row) => row.action === action)
  if (
    !price ||
    !price.configured ||
    !Number.isFinite(price.creditsPerHit) ||
    price.creditsPerHit < 0
  )
    throw new FocusedAgentError(
      "PRICING_UNAVAILABLE",
      "Current pricing is unavailable. No paid operation was started.",
      503,
      true
    )
  return {
    action,
    model: price.model,
    creditsPerUnit: price.creditsPerHit,
    maximumUnits,
    maximumCredits: price.creditsPerHit * maximumUnits,
    pricingUpdatedAt: price.updatedAt,
    note:
      action === "search:local" || action === "search:domain"
        ? "Only returned records with email are billable."
        : action.startsWith("enrich:")
          ? "Only successful enrichment is billable."
          : "Charges depend on returned billable records, up to this approved maximum.",
  }
}
export async function chargeNativeTokens(
  a: AgentActor,
  runId: string,
  step: number,
  inputTokens: number | undefined,
  outputTokens: number | undefined
) {
  if (
    typeof inputTokens !== "number" ||
    typeof outputTokens !== "number" ||
    !Number.isSafeInteger(inputTokens) ||
    !Number.isSafeInteger(outputTokens) ||
    inputTokens < 0 ||
    outputTokens < 0 ||
    inputTokens + outputTokens === 0
  )
    throw new FocusedAgentError(
      "USAGE_REVIEW_REQUIRED",
      "The model did not return usable token accounting.",
      503
    )
  const config = getAiRuntimeConfig("assistant"),
    requestId = `focused-agent:${runId}:${step}`
  const usage = await prisma.focusedAgentUsage.upsert({
    where: { requestId },
    create: {
      runId,
      userId: a.userId,
      subject: a.subject,
      model: config.model,
      inputTokens: inputTokens!,
      outputTokens: outputTokens!,
      requestId,
    },
    update: {},
  })
  if (usage.state === "charged") return
  if (
    !(
      await prisma.focusedAgentUsage.updateMany({
        where: { id: usage.id, state: "pending" },
        data: { state: "charging" },
      })
    ).count
  )
    throw new FocusedAgentError(
      "BILLING_REVIEW_REQUIRED",
      "This token charge is in progress or needs review.",
      409
    )
  const result = await consumeTokenCredits(
    a.userId,
    {
      provider: config.provider,
      model: config.model,
      inputTokens: inputTokens!,
      outputTokens: outputTokens!,
      idempotencyKey: requestId,
    },
    a.email
  )
  await prisma.focusedAgentUsage.update({
    where: { id: usage.id },
    data: { state: result?.success ? "charged" : "needs_review" },
  })
  if (!result?.success)
    throw new FocusedAgentError(
      "BILLING_REVIEW_REQUIRED",
      "The token charge needs review and will not be blindly repeated.",
      503
    )
}

/** Charge the server-owned approved price snapshot, not a price chosen by the model. */
export async function chargeApprovedUnits(
  a: AgentActor,
  proposalId: string,
  cost: {
    creditsPerUnit: number
    maximumUnits: number
    action: PipeLeadsCreditAction
  },
  units: number,
  key: string
) {
  if (!Number.isInteger(units) || units < 0 || units > cost.maximumUnits)
    throw new FocusedAgentError(
      "COST_LIMIT_EXCEEDED",
      "The provider exceeded the approved result limit. Billing requires review.",
      409
    )
  if (!units || cost.creditsPerUnit === 0) return
  // The existing credit adapter converts display credits into its fixed-usage units.
  // Omitting metadata.action intentionally locks the already-approved price.
  const result = await consumeCredits(
    a.userId,
    {
      amount: cost.creditsPerUnit * units,
      description: `Approved ${cost.action} × ${units}`,
      metadata: {
        idempotencyKey: key,
        proposalId,
        approvedAction: cost.action,
        resultCount: units,
      },
    },
    a.email
  )
  if (!result?.success)
    throw new FocusedAgentError(
      "BILLING_REVIEW_REQUIRED",
      "The approved operation's credit charge needs review.",
      503
    )
}
