"use client"

import { useState, useEffect, useRef } from "react"
import { useLabels, useCreateLabel, useDeleteLabel } from "@/hooks/useLabels"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { X, Plus, Loader2, Tag } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { appToast } from "@/lib/app-toast"
import { PageHeader } from "@/components/layout/page-header"

const DEFAULT_LABELS = ["Called", "Messaged", "Emailed", "Exported to CSV"]

export default function CustomLabelsPage() {
  const [newLabel, setNewLabel] = useState("")
  const { data: labels, isLoading, isError, refetch } = useLabels()
  const createLabel = useCreateLabel()
  const deleteLabel = useDeleteLabel()
  const seeded = useRef(false)

  // Seed default labels on first load if none exist
  useEffect(() => {
    if (seeded.current) return
    if (isLoading) return
    if (!labels) return

    if (labels.length === 0) {
      seeded.current = true
      DEFAULT_LABELS.forEach((name) => {
        createLabel.mutate({ name })
      })
    }
  }, [labels, isLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdd = () => {
    const trimmed = newLabel.trim()
    if (!trimmed) return
    createLabel.mutate(
      { name: trimmed },
      {
        onSuccess: () => setNewLabel(""),
        onError: (err) => appToast.error("labelCreate", err),
      }
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleAdd()
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Custom labels"
        description="Labels you can put on any lead to track outreach and organize lists."
      />

      <div className="flex max-w-2xl flex-col gap-6">
      {/* Add Label Section */}
      <Card>
        <CardHeader>
          <CardTitle>Add a label</CardTitle>
          <CardDescription>
            Create labels to categorize and organize your leads.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Tag className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                placeholder="Enter label name..."
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={createLabel.isPending}
                className="pl-8"
                aria-label="Label name"
              />
            </div>
            <Button
              onClick={handleAdd}
              disabled={!newLabel.trim() || createLabel.isPending}
              className="shrink-0"
            >
              {createLabel.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Add
            </Button>
          </div>
          {createLabel.isError && (
            <p className="mt-2 text-sm text-destructive">
              {createLabel.error.message}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Available Labels Section */}
      <Card>
        <CardHeader>
          <CardTitle>Your labels</CardTitle>
          <CardDescription>
            Remove a label with its X. Leads keep their other labels.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isError ? (
            <ErrorState
              message="Failed to load your custom labels."
              onRetry={() => refetch()}
            />
          ) : isLoading ? (
            <div className="flex flex-wrap gap-2" aria-busy aria-label="Loading labels">
              {[0, 1, 2, 3].map((key) => (
                <div key={key} className="h-7 w-24 animate-pulse rounded-full bg-muted" />
              ))}
            </div>
          ) : !labels || labels.length === 0 ? (
            <EmptyState
              size="inline"
              icon={Tag}
              title="No custom labels yet"
              description="Add your first label above to start organizing your leads."
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {labels.map((label) => (
                <span
                  key={label.id}
                  className="inline-flex items-center gap-1 rounded-full border bg-secondary py-1 pr-1 pl-3 text-sm font-medium text-secondary-foreground"
                >
                  {label.name}
                  <button
                    onClick={() =>
                      deleteLabel.mutate(label.id, {
                        onError: (err) => appToast.error("labelDelete", err),
                      })
                    }
                    className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
                    disabled={deleteLabel.isPending}
                    aria-label={`Remove ${label.name}`}
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
