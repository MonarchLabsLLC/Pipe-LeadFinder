import { useMutation, useQueryClient } from "@tanstack/react-query"

export type BulkAction =
  | "APPLY_LABEL"
  | "REMOVE_LABEL"
  | "COPY"
  | "MOVE"
  | "REMOVE"
  | "ENRICH_EMAIL"
  | "ENRICH_PHONE"
  | "SCORE"

export function useBulkAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      listId: string
      entryIds: string[]
      action: BulkAction
      options?: { labelId?: string; targetListId?: string }
    }) => {
      const response = await fetch(`/api/lists/${input.listId}/bulk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          entryIds: input.entryIds,
          action: input.action,
          options: input.options ?? {},
        }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || "Bulk action failed")
      }
      return response.json() as Promise<{
        jobId?: string
        status?: string
        updated?: number
        removed?: number
      }>
    },
    onSuccess: (_result, input) => {
      queryClient.invalidateQueries({ queryKey: ["list-detail", input.listId] })
      queryClient.invalidateQueries({ queryKey: ["lists"] })
      queryClient.invalidateQueries({ queryKey: ["labels"] })
    },
  })
}
