/**
 * Credit System Types
 * Interfaces for integrating with ScaleCredits microservice
 */

/** Credit balance returned from the microservice */
export interface CreditBalance {
  userId: string
  availableCredits: number
  consumedCredits: number
  updatedAt: string | null
  metadata?: Record<string, unknown>
}

/** Result of a pre-operation credit availability check */
export interface CreditCheckResult {
  ok: boolean
  balance?: CreditBalance
  status?: number
  message?: string
}

/**
 * Flat credit usage payload for PipeLeads.
 * Unlike token-based apps (ClickCampaigns, PageBuilder), PipeLeads uses
 * fixed per-action credit costs (e.g. 3 credits per People Search lead).
 */
export interface CreditUsagePayload {
  amount: number
  description: string
  metadata?: {
    appName?: string
    action?: string       // "search:people", "search:local", "enrich:email", etc.
    listId?: string
    leadId?: string
    searchType?: string
    resultCount?: number
    [key: string]: unknown
  }
}

/**
 * Token-based usage payload for AI operations.
 * Sent to the microservice's token-aware consume endpoint.
 */
export interface TokenUsagePayload {
  provider: string   // "openai", "google", "anthropic"
  model: string      // "gpt-4o-mini", "gemini-3-flash-preview", etc.
  inputTokens: number
  outputTokens: number
  appName?: string
}

/** Response from the microservice /credits/consume endpoint */
export interface ConsumeCreditsResponse {
  success: boolean
  debited: number
  availableCredits: number
  consumedCredits?: number
  ledgerEntryId?: string
  error?: string
}

/** Context value exposed by CreditsProvider */
export interface CreditsContextValue {
  balance: CreditBalance | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
  hasSufficientCredits: boolean
  formatCredits: (credits: number) => string
  purchaseUrl: string
  setActivePolling: (active: boolean) => void
}
