import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { LeadScoreSummary } from "@/lib/lead-score"

export interface ScoreLeadsResponse {
  scoredCount: number
  leadScores: Array<LeadScoreSummary & { leadId: string }>
  model?: string
  message?: string
}

export function useScoreLeads() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ listId }: { listId: string }) => {
      const res = await fetch(`/api/lists/${listId}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 100 }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Lead scoring failed")
      }
      return res.json() as Promise<ScoreLeadsResponse>
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["list-detail", variables.listId],
      })
    },
  })
}
