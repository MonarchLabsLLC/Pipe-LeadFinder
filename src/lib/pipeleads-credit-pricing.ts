export const CREDIT_DISPLAY_SCALE = 10
export const DISPLAY_CREDITS_PER_USD = 200
export const TARGET_PEOPLE_SEARCH_DISPLAY_CREDITS = 100
export const TARGET_PEOPLE_SEARCH_USD =
  TARGET_PEOPLE_SEARCH_DISPLAY_CREDITS / DISPLAY_CREDITS_PER_USD

export const CREDIT_COSTS = {
  "search:people": 100, // per contact
  "search:local": 50, // per business (free if no email)
  "search:company": 50, // per company
  "search:domain": 50, // per contact
  "search:influencer": 50, // per profile
  "enrich:email": 50, // per lead
  "enrich:phone": 50, // per lead
} as const

export function getScaledDisplayCredits(credits: number) {
  return credits
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
