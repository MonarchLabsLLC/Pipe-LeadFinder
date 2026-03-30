import { useMutation, useQueryClient } from "@tanstack/react-query"

export function useEnrichEmail() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ leadId }: { leadId: string }) => {
      const res = await fetch("/api/enrich/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Email enrichment failed")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lists"] })
    },
  })
}

export function useEnrichPhone() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ leadId }: { leadId: string }) => {
      const res = await fetch("/api/enrich/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Phone enrichment failed")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lists"] })
    },
  })
}

export function useEnrichBulk() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ listId }: { listId: string }) => {
      const res = await fetch("/api/enrich/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Bulk enrichment failed")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lists"] })
    },
  })
}
