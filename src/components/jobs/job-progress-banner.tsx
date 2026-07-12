"use client"

import { useEffect, useRef } from "react"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import { useJob } from "@/hooks/useJob"

export function JobProgressBanner({
  jobId,
  onComplete,
}: {
  jobId?: string | null
  onComplete?: () => void
}) {
  const { data: job, error } = useJob(jobId)
  const completedJobRef = useRef<string | null>(null)

  useEffect(() => {
    if (
      job?.status === "COMPLETED" &&
      completedJobRef.current !== job.jobId
    ) {
      completedJobRef.current = job.jobId
      onComplete?.()
    }
  }, [job, onComplete])

  if (!jobId) return null
  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Operation status could not be loaded. Refresh to try again.
      </div>
    )
  }
  if (!job) {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-card p-4 text-sm">
        <Loader2 className="size-4 animate-spin" /> Loading operation status…
      </div>
    )
  }

  const active = job.status === "QUEUED" || job.status === "RUNNING"
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2">
        {active ? (
          <Loader2 className="size-4 animate-spin text-primary" />
        ) : job.status === "COMPLETED" ? (
          <CheckCircle2 className="size-4 text-emerald-600" />
        ) : (
          <AlertCircle className="size-4 text-destructive" />
        )}
        <p className="text-sm font-medium">{job.stage || job.status}</p>
        <span className="ml-auto text-xs text-muted-foreground">
          {job.progress.percent}%
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${job.progress.percent}%` }}
        />
      </div>
      {job.error && (
        <p className="mt-2 text-sm text-destructive">{job.error.message}</p>
      )}
    </div>
  )
}
