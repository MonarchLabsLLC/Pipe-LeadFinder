"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import type {
  PipeLeadsPricingItem,
  PipeLeadsPricingMap,
} from "@/lib/pipeleads-credit-pricing"

export function usePipeLeadsPricing() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["pipeleads-pricing"],
    queryFn: async () => {
      const res = await fetch("/api/credits/pricing", {
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to load PipeLeads pricing")
      return (await res.json()) as { items: PipeLeadsPricingItem[] }
    },
    staleTime: 60_000,
  })

  const pricingMap = useMemo<PipeLeadsPricingMap>(() => {
    const items = data?.items ?? []
    return items.reduce<PipeLeadsPricingMap>((acc, item) => {
      acc[item.action] = item
      return acc
    }, {})
  }, [data])

  return {
    items: data?.items ?? [],
    pricingMap,
    isLoading,
    error,
  }
}
