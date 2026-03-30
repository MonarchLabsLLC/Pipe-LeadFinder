"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useLabels } from "@/hooks/useLabels"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { X, Plus, Loader2 } from "lucide-react"

interface AppliedLabel {
  id: string
  name: string
  labelId?: string
  entryId?: string
}

interface LeadLabelsProps {
  entryId: string
  leadId: string
  appliedLabels: AppliedLabel[]
}

export function LeadLabels({ entryId, leadId, appliedLabels }: LeadLabelsProps) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const { data: allLabels } = useLabels()

  const applyLabel = useMutation({
    mutationFn: async (labelId: string) => {
      const res = await fetch(`/api/leads/${leadId}/labels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labelId, entryId }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to apply label")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-labels", leadId] })
      queryClient.invalidateQueries({ queryKey: ["leads"] })
    },
  })

  const removeLabel = useMutation({
    mutationFn: async (labelId: string) => {
      const res = await fetch(`/api/leads/${leadId}/labels/${labelId}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to remove label")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-labels", leadId] })
      queryClient.invalidateQueries({ queryKey: ["leads"] })
    },
  })

  // Filter out already-applied labels
  const appliedLabelIds = new Set(
    appliedLabels.map((l) => l.labelId ?? l.id)
  )
  const availableLabels = allLabels?.filter(
    (l) => !appliedLabelIds.has(l.id)
  )

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {appliedLabels.map((label) => (
        <Badge
          key={label.id}
          variant="secondary"
          className="gap-0.5 py-0 px-1.5 text-xs"
        >
          {label.name}
          <button
            onClick={() => removeLabel.mutate(label.labelId ?? label.id)}
            className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5 transition-colors"
            disabled={removeLabel.isPending}
            aria-label={`Remove ${label.name}`}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </Badge>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            aria-label="Add label"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground px-2 py-1">
              Apply Label
            </p>
            {!availableLabels || availableLabels.length === 0 ? (
              <p className="text-xs text-muted-foreground px-2 py-1">
                No labels available
              </p>
            ) : (
              availableLabels.map((label) => (
                <button
                  key={label.id}
                  onClick={() => {
                    applyLabel.mutate(label.id)
                    setOpen(false)
                  }}
                  disabled={applyLabel.isPending}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors text-left"
                >
                  {applyLabel.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : null}
                  {label.name}
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
