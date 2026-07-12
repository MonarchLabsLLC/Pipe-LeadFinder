import { useQuery } from "@tanstack/react-query"

export interface JobRunView {
  jobId: string
  kind: string
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED"
  stage: string | null
  progress: { current: number; total: number; percent: number }
  result: Record<string, unknown> | null
  error: { code: string; message: string } | null
  resources: { listId: string | null; searchId: string | null; agentId: string | null }
}

export function useJob(jobId?: string | null) {
  return useQuery<JobRunView>({
    queryKey: ["job", jobId],
    queryFn: async () => {
      const response = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" })
      if (!response.ok) throw new Error("Failed to load operation status")
      return response.json()
    },
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === "QUEUED" || status === "RUNNING" ? 1_500 : false
    },
  })
}
