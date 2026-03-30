"use client"

import { useState, useEffect, useRef } from "react"
import { useLabels, useCreateLabel, useDeleteLabel } from "@/hooks/useLabels"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { X, Plus, Loader2, Tag } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"

const DEFAULT_LABELS = ["Called", "Messaged", "Emailed", "Exported to CSV"]

export default function CustomLabelsPage() {
  const [newLabel, setNewLabel] = useState("")
  const { data: labels, isLoading } = useLabels()
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
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Add Label Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add Custom Lead Label</CardTitle>
          <CardDescription>
            Create labels to categorize and organize your leads.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Enter label name..."
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={createLabel.isPending}
                className="pl-9"
              />
            </div>
            <Button
              onClick={handleAdd}
              disabled={!newLabel.trim() || createLabel.isPending}
              className="shrink-0 shadow-sm"
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
          <CardTitle className="text-base">Available Labels</CardTitle>
          <CardDescription>
            Click the X on any label to remove it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading labels...
            </div>
          ) : !labels || labels.length === 0 ? (
            <div className="py-2">
              <EmptyState
                icon={Tag}
                title="No custom labels yet"
                description="Add your first label above to start organizing your leads."
              />
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {labels.map((label) => (
                <span
                  key={label.id}
                  className="group/chip inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted-foreground/10"
                >
                  {label.name}
                  <button
                    onClick={() => deleteLabel.mutate(label.id)}
                    className="ml-0.5 rounded-full p-0.5 opacity-0 group-hover/chip:opacity-100 hover:bg-muted-foreground/20 transition-all"
                    disabled={deleteLabel.isPending}
                    aria-label={`Remove ${label.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
