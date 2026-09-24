import {
  getPipeLeadsCreditCost,
  type PipeLeadsCreditAction,
  type PipeLeadsPricingMap,
} from "@/lib/pipeleads-credit-pricing"

/**
 * The balance is "low" once it no longer covers a modest People search:
 * 25 results at the current per-contact price.
 */
export const LOW_BALANCE_PEOPLE_RESULTS = 25

export type CreditsTone = "normal" | "low" | "empty"

export function lowBalanceThreshold(pricing?: PipeLeadsPricingMap | null): number {
  return LOW_BALANCE_PEOPLE_RESULTS * getPipeLeadsCreditCost("search:people", pricing)
}

/** empty at or below zero, low below the threshold, normal otherwise. */
export function creditsTone(available: number, threshold: number): CreditsTone {
  if (available <= 0) return "empty"
  if (available < threshold) return "low"
  return "normal"
}

/** The search types, in the order the New Search page shows them. */
export const SEARCH_PRICE_ROWS: {
  action: PipeLeadsCreditAction
  label: string
  unit: string
}[] = [
  { action: "search:people", label: "People", unit: "contact" },
  { action: "search:local", label: "Local", unit: "business" },
  { action: "search:company", label: "Company", unit: "company" },
  { action: "search:domain", label: "Domain", unit: "contact" },
  { action: "search:influencer", label: "Influencer", unit: "profile" },
]

export function searchPriceList(pricing?: PipeLeadsPricingMap | null) {
  return SEARCH_PRICE_ROWS.map((row) => ({
    ...row,
    credits: getPipeLeadsCreditCost(row.action, pricing),
  }))
}
