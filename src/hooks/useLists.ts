import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { SearchType } from "@/generated/prisma/enums"

export interface ListSummary {
  id: string
  name: string
  type: SearchType
  status: "ACTIVE" | "ARCHIVED"
  createdAt: string
  updatedAt: string
  leadCount: number
  emailFoundCount: number
}

async function fetchLists(type?: SearchType, status?: string): Promise<ListSummary[]> {
  const params = new URLSearchParams()
  if (type) params.set("type", type)
  if (status) params.set("status", status)
  const res = await fetch(`/api/lists?${params.toString()}`)
  if (!res.ok) throw new Error("Failed to fetch lists")
  return res.json()
}

export function useLists(filter?: SearchType, status?: string) {
  return useQuery({
    queryKey: ["lists", filter ?? "ALL", status ?? "ACTIVE"],
    queryFn: () => fetchLists(filter, status),
  })
}

export function useCreateList() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { name: string; type: SearchType }) => {
      const res = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to create list")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lists"] })
    },
  })
}

export function useUpdateList() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string
      name?: string
      status?: "ACTIVE" | "ARCHIVED"
    }) => {
      const res = await fetch(`/api/lists/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to update list")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lists"] })
    },
  })
}

export function useDeleteList() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/lists/${id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to delete list")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lists"] })
    },
  })
}
