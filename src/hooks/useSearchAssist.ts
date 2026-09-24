import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { SearchType } from "@/generated/prisma/enums"

export type InterpretResponse =
  | {
      ok: true
      searchType: SearchType
      fields: Record<string, unknown>
      explanation: string
      droppedFields: string[]
    }
  | { ok: false; reason: "unclear"; message: string }

export class SearchAssistError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly purchaseUrl?: string
  ) {
    super(message)
  }
}

async function readError(res: Response, fallback: string) {
  const body = (await res.json().catch(() => ({}))) as { error?: unknown; purchaseUrl?: string }
  const message = typeof body.error === "string" ? body.error : fallback
  return new SearchAssistError(message, res.status, body.purchaseUrl)
}

/** "Describe who you want" — returns a proposed search, never runs one. */
export function useInterpretSearch() {
  return useMutation({
    mutationFn: async (text: string): Promise<InterpretResponse> => {
      const res = await fetch("/api/search/interpret", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw await readError(res, "We couldn't read that description")
      return res.json()
    },
  })
}

export interface RecentSearch {
  id: string
  searchType: SearchType
  parameters: Record<string, unknown> | null
  resultCount: number
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED"
  createdAt: string
  list: { id: string; name: string } | null
}

export function useRecentSearches() {
  return useQuery({
    queryKey: ["recent-searches"],
    queryFn: async (): Promise<{ searches: RecentSearch[]; canRerun: boolean }> => {
      const res = await fetch("/api/search/recent")
      if (!res.ok) throw await readError(res, "Failed to load recent searches")
      return res.json()
    },
    staleTime: 15_000,
  })
}

/** Runs a saved search again into the same list (existing rerun route). */
export function useRerunSearch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (searchId: string): Promise<{ jobId: string; listId: string }> => {
      const res = await fetch(`/api/search/${searchId}/rerun`, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
      })
      if (!res.ok) throw await readError(res, "Could not run that search again")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recent-searches"] })
    },
  })
}
