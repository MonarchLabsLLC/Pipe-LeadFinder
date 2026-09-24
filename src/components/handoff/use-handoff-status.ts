"use client"

import { useQuery } from "@tanstack/react-query"
import { useSession } from "next-auth/react"

export type HandoffStatus = { pipeleads: boolean; mailbaser: boolean }

/** Which one-click targets are configured. Both false until known. */
export function useHandoffStatus(): HandoffStatus {
  const { data } = useQuery({
    queryKey: ["handoff-status"],
    queryFn: async (): Promise<HandoffStatus> => {
      const response = await fetch("/api/handoff/status")
      if (!response.ok) return { pipeleads: false, mailbaser: false }
      return response.json()
    },
    staleTime: Infinity,
    retry: false,
  })
  return data ?? { pipeleads: false, mailbaser: false }
}

export function useHandoffUserId(): string | null {
  const { data } = useSession()
  return data?.user?.id ?? null
}
