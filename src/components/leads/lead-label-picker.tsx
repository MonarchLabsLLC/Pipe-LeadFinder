"use client"

import { useState } from "react"
import Link from "next/link"
import { Loader2, Plus, Settings2, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  useApplyLabel,
  useCreateLabel,
  useLabels,
  useRemoveLabel,
  type Label,
} from "@/hooks/useLabels"
import { appToast } from "@/lib/app-toast"

interface LeadLabelPickerProps {
  entryId: string
  labels: { id: string; name: string }[]
  /** Show a remove button on each applied label. */
  removable?: boolean
}

/**
 * The labels on one lead, plus an "Add" menu that applies an existing label
 * or creates a new one on the spot and applies it.
 */
export function LeadLabelPicker({ entryId, labels, removable = false }: LeadLabelPickerProps) {
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const { data: availableLabels = [], isLoading } = useLabels()
  const applyLabel = useApplyLabel()
  const removeLabel = useRemoveLabel()
  const createLabel = useCreateLabel()

  const appliedIds = new Set(labels.map((label) => label.id))
  const unapplied = availableLabels.filter((label) => !appliedIds.has(label.id))
  const busy = applyLabel.isPending || createLabel.isPending

  const apply = (labelId: string) => {
    applyLabel.mutate(
      { entryId, labelId },
      {
        onSuccess: () => {
          appToast.success("Label applied", "This lead was updated.")
          setOpen(false)
        },
        onError: (error) => appToast.error("applyLabel", error),
      }
    )
  }

  const createAndApply = () => {
    const name = newName.trim()
    if (!name || busy) return
    const existing = availableLabels.find(
      (label) => label.name.toLowerCase() === name.toLowerCase()
    )
    if (existing) {
      setNewName("")
      if (appliedIds.has(existing.id)) {
        appToast.info("Already applied", `“${existing.name}” is already on this lead.`)
        return
      }
      apply(existing.id)
      return
    }
    createLabel.mutate(
      { name },
      {
        onSuccess: (created: Label) => {
          setNewName("")
          apply(created.id)
        },
        onError: (error) => appToast.error("labelCreate", error),
      }
    )
  }

  const remove = (labelId: string) => {
    removeLabel.mutate(
      { entryId, labelId },
      {
        onSuccess: () => appToast.success("Label removed", "This lead was updated."),
        onError: (error) => appToast.error("removeLabel", error),
      }
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {labels.map((label) => (
        <Badge key={label.id} variant="secondary" className="gap-1">
          {label.name}
          {removable && (
            <button
              type="button"
              onClick={() => remove(label.id)}
              disabled={removeLabel.isPending}
              className="rounded-full p-0.5 transition-colors hover:bg-muted-foreground/20"
              aria-label={`Remove ${label.name}`}
            >
              <X className="size-2.5" />
            </button>
          )}
        </Badge>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="xs" disabled={busy} aria-label="Add a label">
            {busy ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
            Add
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-60 p-2" align="start">
          <div className="space-y-1">
            <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Apply a label</p>
            {isLoading ? (
              <p className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" /> Loading labels…
              </p>
            ) : unapplied.length === 0 ? (
              <p className="px-2 py-1 text-xs text-muted-foreground">
                {availableLabels.length === 0
                  ? "No labels yet. Create your first one below."
                  : "Every label is already on this lead."}
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto">
                {unapplied.map((label) => (
                  <button
                    key={label.id}
                    type="button"
                    className="w-full rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                    disabled={busy}
                    onClick={() => apply(label.id)}
                  >
                    {label.name}
                  </button>
                ))}
              </div>
            )}
            <form
              className="flex items-center gap-1 border-t px-1 pt-2"
              onSubmit={(event) => {
                event.preventDefault()
                createAndApply()
              }}
            >
              <Input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="New label name"
                maxLength={50}
                className="h-7 text-xs"
                aria-label="New label name"
              />
              <Button type="submit" size="xs" disabled={!newName.trim() || busy}>
                Create
              </Button>
            </form>
            <Link
              href="/lead-search/custom-labels"
              className="flex items-center gap-1.5 px-2 pt-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Settings2 className="size-3" /> Manage labels
            </Link>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
