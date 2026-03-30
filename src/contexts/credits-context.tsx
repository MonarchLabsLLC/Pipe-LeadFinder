"use client"

/**
 * Credits Context Provider
 *
 * Polling-based credit balance for the PipeLeads frontend.
 * Matches the ClickCampaigns/PageBuilder pattern — polls /api/credits
 * every 30s (5s during active operations).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import type { CreditBalance, CreditsContextValue } from "@/types/credits"

const PURCHASE_URL =
  process.env.NEXT_PUBLIC_SCALECREDITS_URL || "https://credits.scaleplus.gg"
const POLL_IDLE_MS = 30_000
const POLL_ACTIVE_MS = 5_000

const CreditsContext = createContext<CreditsContextValue | null>(null)

export function CreditsProvider({ children }: { children: React.ReactNode }) {
  const [balance, setBalance] = useState<CreditBalance | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isActiveRef = useRef(false)
  const balanceRef = useRef<CreditBalance | null>(null)

  const formatCredits = useCallback(
    (credits: number) =>
      credits.toLocaleString(undefined, { maximumFractionDigits: 0 }),
    []
  )

  const fetchBalance = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) setIsLoading(true)

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10_000)

      try {
        const res = await fetch("/api/credits", {
          credentials: "include",
          signal: controller.signal,
        })
        clearTimeout(timeout)

        if (res.status === 401) {
          balanceRef.current = null
          setBalance(null)
          setError(null)
          return
        }
        if (!res.ok) throw new Error(`Failed to fetch credits: ${res.status}`)

        const data = (await res.json()) as CreditBalance
        balanceRef.current = data
        setBalance(data)
        setError(null)
      } catch (err: unknown) {
        clearTimeout(timeout)
        if ((err as Error).name === "AbortError") return // keep last known
        throw err
      }
    } catch (err) {
      if (!balanceRef.current) {
        setError(err instanceof Error ? err : new Error("Failed to fetch credits"))
      }
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }, [])

  // Start/restart polling
  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    const ms = isActiveRef.current ? POLL_ACTIVE_MS : POLL_IDLE_MS
    pollRef.current = setInterval(() => fetchBalance(false), ms)
  }, [fetchBalance])

  useEffect(() => {
    fetchBalance(true)
    startPolling()
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchBalance, startPolling])

  const setActivePolling = useCallback(
    (active: boolean) => {
      if (isActiveRef.current === active) return
      isActiveRef.current = active
      startPolling()
      if (active) fetchBalance(false)
    },
    [fetchBalance, startPolling]
  )

  const refetch = useCallback(async () => {
    await fetchBalance(false)
  }, [fetchBalance])

  const hasSufficientCredits =
    balance !== null && balance.availableCredits >= 0

  return (
    <CreditsContext.Provider
      value={{
        balance,
        isLoading,
        error,
        refetch,
        hasSufficientCredits,
        formatCredits,
        purchaseUrl: PURCHASE_URL,
        setActivePolling,
      }}
    >
      {children}
    </CreditsContext.Provider>
  )
}

/** Hook to access credit balance and utilities */
export function useCredits(): CreditsContextValue {
  const ctx = useContext(CreditsContext)
  if (!ctx) throw new Error("useCredits must be used within <CreditsProvider>")
  return ctx
}

/** Hook for quick credit availability check */
export function useCreditsCheck() {
  const { balance, hasSufficientCredits } = useCredits()
  return {
    checkCredits: () => hasSufficientCredits,
    hasSufficientCredits,
    availableCredits: balance?.availableCredits ?? 0,
  }
}
