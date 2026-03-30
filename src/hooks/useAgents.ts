import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { AgentStatus } from "@/generated/prisma/enums"

export interface AgentSummary {
  id: string
  name: string
  description: string | null
  status: AgentStatus
  config: Record<string, unknown> | null
  autoSave: boolean
  createdAt: string
  updatedAt: string
}

async function fetchAgents(status?: AgentStatus): Promise<AgentSummary[]> {
  const params = new URLSearchParams()
  if (status) params.set("status", status)
  const res = await fetch(`/api/ai/agent?${params.toString()}`)
  if (!res.ok) throw new Error("Failed to fetch agents")
  return res.json()
}

async function fetchAgent(id: string): Promise<AgentSummary> {
  const res = await fetch(`/api/ai/agent/${id}`)
  if (!res.ok) throw new Error("Failed to fetch agent")
  return res.json()
}

export function useAgents(status?: AgentStatus) {
  return useQuery({
    queryKey: ["agents", status ?? "ALL"],
    queryFn: () => fetchAgents(status),
  })
}

export function useAgent(id: string) {
  return useQuery({
    queryKey: ["agents", id],
    queryFn: () => fetchAgent(id),
    enabled: !!id,
  })
}

export function useCreateAgent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { name: string; description?: string; autoSave?: boolean }) => {
      const res = await fetch("/api/ai/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to create agent")
      }
      return res.json() as Promise<AgentSummary>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] })
    },
  })
}

export function useUpdateAgent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string
      name?: string
      description?: string
      status?: AgentStatus
      config?: Record<string, unknown>
      autoSave?: boolean
    }) => {
      const res = await fetch(`/api/ai/agent/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to update agent")
      }
      return res.json() as Promise<AgentSummary>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] })
    },
  })
}

export function useDeleteAgent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/ai/agent/${id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to delete agent")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] })
    },
  })
}

export function useRunAgent() {
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/ai/agent/${id}/run`, {
        method: "POST",
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to run agent")
      }
      return res.json()
    },
  })
}
