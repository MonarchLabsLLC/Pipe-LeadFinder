"use client"

import { useState } from "react"
import {
  usePrompts,
  useCreatePrompt,
  useUpdatePrompt,
  useDeletePrompt,
  type PromptTemplate,
} from "@/hooks/usePrompts"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  BookTemplate,
  X,
  Check,
} from "lucide-react"

const VARIABLES = ["{name}", "{company}", "{title}", "{email}", "{location}"]

export default function AiAssistantPage() {
  const [newName, setNewName] = useState("")
  const [newPrompt, setNewPrompt] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editPrompt, setEditPrompt] = useState("")
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const { data: templates, isLoading } = usePrompts()
  const createPrompt = useCreatePrompt()
  const updatePrompt = useUpdatePrompt()
  const deletePrompt = useDeletePrompt()

  const handleCreate = () => {
    const trimmedName = newName.trim()
    const trimmedPrompt = newPrompt.trim()
    if (!trimmedName || !trimmedPrompt) return

    createPrompt.mutate(
      { name: trimmedName, prompt: trimmedPrompt },
      {
        onSuccess: () => {
          setNewName("")
          setNewPrompt("")
        },
      }
    )
  }

  const handleStartEdit = (template: PromptTemplate) => {
    setEditingId(template.id)
    setEditName(template.name)
    setEditPrompt(template.prompt)
    setDeleteConfirmId(null)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditName("")
    setEditPrompt("")
  }

  const handleSaveEdit = () => {
    if (!editingId) return
    const trimmedName = editName.trim()
    const trimmedPrompt = editPrompt.trim()
    if (!trimmedName || !trimmedPrompt) return

    updatePrompt.mutate(
      { id: editingId, data: { name: trimmedName, prompt: trimmedPrompt } },
      {
        onSuccess: () => {
          setEditingId(null)
          setEditName("")
          setEditPrompt("")
        },
      }
    )
  }

  const handleDelete = (id: string) => {
    deletePrompt.mutate(id, {
      onSuccess: () => {
        setDeleteConfirmId(null)
      },
    })
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Lead paragraph */}
      <p className="text-muted-foreground text-sm leading-relaxed max-w-2xl">
        Create reusable prompt templates for your AI Assistant. Use variables to
        personalize content dynamically for each lead.
      </p>

      {/* Create Template Section */}
      <Card className="p-6">
        <h2 className="text-base font-semibold mb-4">Create Template</h2>
        <div className="space-y-4">
          <Input
            placeholder="Template name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            disabled={createPrompt.isPending}
          />
          <Textarea
            placeholder="Write your prompt... Use {name}, {company}, {title} for personalization"
            value={newPrompt}
            onChange={(e) => setNewPrompt(e.target.value)}
            rows={6}
            className="font-mono text-sm"
            disabled={createPrompt.isPending}
          />
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-wrap gap-1.5">
              {VARIABLES.map((v) => (
                <code
                  key={v}
                  className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground"
                >
                  {v}
                </code>
              ))}
            </div>
            <Button
              onClick={handleCreate}
              disabled={
                !newName.trim() || !newPrompt.trim() || createPrompt.isPending
              }
              className="shrink-0"
            >
              {createPrompt.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Create Template
            </Button>
          </div>
          {createPrompt.isError && (
            <p className="text-sm text-destructive">
              {createPrompt.error.message}
            </p>
          )}
        </div>
      </Card>

      {/* Templates List */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold">Your Templates</h2>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-5">
                <div className="space-y-3">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-16 w-full" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-5 w-14" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : !templates || templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-10 text-center">
            <BookTemplate className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">
              No prompt templates yet. Create your first template above.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((template) => (
              <Card
                key={template.id}
                className="group relative border-l-[3px] border-l-primary/20 hover:border-l-primary/60 transition-colors"
              >
                {editingId === template.id ? (
                  /* Edit Mode */
                  <div className="space-y-3 p-5">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Template name"
                      disabled={updatePrompt.isPending}
                    />
                    <Textarea
                      value={editPrompt}
                      onChange={(e) => setEditPrompt(e.target.value)}
                      placeholder="Write your prompt..."
                      rows={5}
                      className="font-mono text-sm"
                      disabled={updatePrompt.isPending}
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={handleSaveEdit}
                        disabled={
                          !editName.trim() ||
                          !editPrompt.trim() ||
                          updatePrompt.isPending
                        }
                      >
                        {updatePrompt.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="mr-2 h-4 w-4" />
                        )}
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancelEdit}
                        disabled={updatePrompt.isPending}
                      >
                        <X className="mr-1 h-4 w-4" />
                        Cancel
                      </Button>
                    </div>
                    {updatePrompt.isError && (
                      <p className="text-sm text-destructive">
                        {updatePrompt.error.message}
                      </p>
                    )}
                  </div>
                ) : (
                  /* Display Mode */
                  <div className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-sm truncate">
                          {template.name}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Created {formatDate(template.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2"
                          onClick={() => handleStartEdit(template)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {deleteConfirmId === template.id ? (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-8 px-2 text-xs"
                              onClick={() => handleDelete(template.id)}
                              disabled={deletePrompt.isPending}
                            >
                              {deletePrompt.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                "Confirm"
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2 text-xs"
                              onClick={() => setDeleteConfirmId(null)}
                              disabled={deletePrompt.isPending}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2"
                            onClick={() => {
                              setDeleteConfirmId(template.id)
                              setEditingId(null)
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <p className="font-mono text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3 leading-relaxed bg-muted/40 rounded-md px-3 py-2">
                      {template.prompt}
                    </p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
