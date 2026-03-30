import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

export interface Label {
  id: string
  name: string
  userId: string
  createdAt: string
}

async function fetchLabels(): Promise<Label[]> {
  const res = await fetch("/api/labels")
  if (!res.ok) throw new Error("Failed to fetch labels")
  return res.json()
}

export function useLabels() {
  return useQuery({
    queryKey: ["labels"],
    queryFn: fetchLabels,
  })
}

export function useCreateLabel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { name: string }) => {
      const res = await fetch("/api/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to create label")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["labels"] })
    },
  })
}

export function useDeleteLabel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/labels/${id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to delete label")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["labels"] })
    },
  })
}
