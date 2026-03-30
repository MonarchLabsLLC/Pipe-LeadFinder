"use client"

import { useState, useEffect, useRef } from "react"
import { useLabels, useCreateLabel, useDeleteLabel } from "@/hooks/useLabels"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { X, Plus, Loader2, Tag } from "lucide-react"

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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Custom Labels</h1>
        <p className="text-muted-foreground mt-1">
          Create labels to categorize and organize your leads.
        </p>
      </div>

      {/* Add Label Section */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Add Custom Lead Label</h2>
        <div className="flex items-center gap-3 max-w-md">
          <Input
            placeholder="Enter label name..."
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={createLabel.isPending}
          />
          <Button
            onClick={handleAdd}
            disabled={!newLabel.trim() || createLabel.isPending}
          >
            {createLabel.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add Label
          </Button>
        </div>
        {createLabel.isError && (
          <p className="text-sm text-destructive">
            {createLabel.error.message}
          </p>
        )}
      </div>

      {/* Available Labels Section */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Available Custom Lead Labels</h2>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading labels...
          </div>
        ) : !labels || labels.length === 0 ? (
          <div className="flex items-center gap-2 text-muted-foreground py-4">
            <Tag className="h-4 w-4" />
            No custom labels yet
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {labels.map((label) => (
              <Badge
                key={label.id}
                variant="secondary"
                className="gap-1 py-1 px-3 text-sm"
              >
                {label.name}
                <button
                  onClick={() => deleteLabel.mutate(label.id)}
                  className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5 transition-colors"
                  disabled={deleteLabel.isPending}
                  aria-label={`Remove ${label.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
