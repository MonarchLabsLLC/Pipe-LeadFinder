export const LEAD_SCORE_PROMPT_PREFIX = "PIPELEADS_LEAD_SCORE_V1"

export type LeadScoreLabel = "Hot" | "Warm" | "Research" | "Low"

export interface LeadScoreSummary {
  score: number
  label: LeadScoreLabel
  bestAngle: string
  why: string[]
  suggestedOpener: string
  nextAction: string
  scoredAt?: string
  model?: string | null
}

export function buildLeadScorePromptTag(listId: string) {
  return `${LEAD_SCORE_PROMPT_PREFIX}:${listId}`
}

function clampScore(score: unknown) {
  const parsed = typeof score === "number" ? score : Number(score)
  if (!Number.isFinite(parsed)) return 0
  return Math.min(100, Math.max(0, Math.round(parsed)))
}

function normalizeLabel(label: unknown, score: number): LeadScoreLabel {
  if (
    label === "Hot" ||
    label === "Warm" ||
    label === "Research" ||
    label === "Low"
  ) {
    return label
  }
  if (score >= 80) return "Hot"
  if (score >= 60) return "Warm"
  if (score >= 40) return "Research"
  return "Low"
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export function parseLeadScoreResult(
  result?: string | null
): LeadScoreSummary | null {
  if (!result) return null

  try {
    const parsed = JSON.parse(result) as Partial<LeadScoreSummary>
    const score = clampScore(parsed.score)
    const why = Array.isArray(parsed.why)
      ? parsed.why.map(normalizeString).filter(Boolean).slice(0, 4)
      : []

    return {
      score,
      label: normalizeLabel(parsed.label, score),
      bestAngle: normalizeString(parsed.bestAngle),
      why,
      suggestedOpener: normalizeString(parsed.suggestedOpener),
      nextAction: normalizeString(parsed.nextAction),
      scoredAt: normalizeString(parsed.scoredAt) || undefined,
      model: parsed.model ?? null,
    }
  } catch {
    return null
  }
}
