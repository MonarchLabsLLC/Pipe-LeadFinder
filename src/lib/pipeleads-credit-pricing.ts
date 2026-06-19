export const CREDIT_DISPLAY_SCALE = 10
export const DISPLAY_CREDITS_PER_USD = 200
export const TARGET_PEOPLE_SEARCH_USD = 0.8

export const CREDIT_COSTS = {
  "search:people": 3, // per contact
  "search:local": 1, // per business (free if no email)
  "search:company": 1, // per company
  "search:domain": 1, // per contact
  "search:influencer": 2, // per profile
  "enrich:email": 1, // per lead
  "enrich:phone": 1, // per lead
} as const

const DEFAULT_FIXED_CREDIT_PRICE_MULTIPLIER =
  (TARGET_PEOPLE_SEARCH_USD * DISPLAY_CREDITS_PER_USD) /
  CREDIT_COSTS["search:people"]

function getConfiguredCreditMultiplier() {
  if (typeof process === "undefined") return undefined

  return (
    process.env.NEXT_PUBLIC_PIPELEADS_FIXED_CREDIT_MULTIPLIER ||
    process.env.PIPELEADS_FIXED_CREDIT_MULTIPLIER
  )
}

export function getFixedCreditPriceMultiplier() {
  const configured = getConfiguredCreditMultiplier()
  const parsed = configured ? Number(configured) : NaN
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_FIXED_CREDIT_PRICE_MULTIPLIER
}

export function getScaledDisplayCredits(baseCredits: number) {
  return baseCredits * getFixedCreditPriceMultiplier()
}

export function formatDisplayCredits(credits: number) {
  return credits.toLocaleString(undefined, {
    maximumFractionDigits: Number.isInteger(credits) ? 0 : 2,
  })
}

export function formatScaledCreditLabel(baseCredits: number, unit: string) {
  return `${formatDisplayCredits(getScaledDisplayCredits(baseCredits))} credits / ${unit}`
}

export function formatScaledCreditText(baseCredits: number, unit: string) {
  return `${formatDisplayCredits(getScaledDisplayCredits(baseCredits))} credits per ${unit}`
}
