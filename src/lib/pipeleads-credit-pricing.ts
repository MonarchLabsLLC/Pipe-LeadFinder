export const CREDIT_DISPLAY_SCALE = 10
export const DISPLAY_CREDITS_PER_USD = 200
export const TARGET_PEOPLE_SEARCH_DISPLAY_CREDITS = 50
export const TARGET_PEOPLE_SEARCH_USD =
  TARGET_PEOPLE_SEARCH_DISPLAY_CREDITS / DISPLAY_CREDITS_PER_USD

export const CREDIT_COSTS = {
  "search:people": 50, // per contact
  "search:local": 25, // per business (free if no email)
  "search:company": 25, // per company
  "search:domain": 25, // per contact
  "search:influencer": 25, // per profile
  "enrich:email": 25, // per lead
  "enrich:phone": 25, // per lead
} as const

export const PIPELEADS_PRICING_MODELS = {
  "search:people": "pipeleads.search.people",
  "search:local": "pipeleads.search.local",
  "search:company": "pipeleads.search.company",
  "search:domain": "pipeleads.search.domain",
  "search:influencer": "pipeleads.search.influencer",
  "enrich:email": "pipeleads.enrich.email",
  "enrich:phone": "pipeleads.enrich.phone",
} as const

export type PipeLeadsCreditAction = keyof typeof CREDIT_COSTS

export interface PipeLeadsPricingItem {
  model: string
  action: PipeLeadsCreditAction
  label: string
  unit: string
  usdPerHit: number
  multiplier: number
  creditsPerHit: number
  configured: boolean
  updatedAt: string | null
}

export type PipeLeadsPricingMap = Partial<
  Record<PipeLeadsCreditAction, PipeLeadsPricingItem>
>

export function getScaledDisplayCredits(credits: number) {
  return credits
}

export function formatDisplayCredits(credits: number) {
  return credits.toLocaleString(undefined, {
    maximumFractionDigits: Number.isInteger(credits) ? 0 : 2,
  })
}

export function getPipeLeadsCreditCost(
  action: PipeLeadsCreditAction,
  pricing?: PipeLeadsPricingMap | null
) {
  return pricing?.[action]?.creditsPerHit ?? CREDIT_COSTS[action]
}

export function formatScaledCreditLabel(baseCredits: number, unit: string) {
  return `${formatDisplayCredits(getScaledDisplayCredits(baseCredits))} credits / ${unit}`
}

export function formatScaledCreditText(baseCredits: number, unit: string) {
  return `${formatDisplayCredits(getScaledDisplayCredits(baseCredits))} credits per ${unit}`
}
