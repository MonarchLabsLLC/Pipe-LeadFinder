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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  BookTemplate,
  Braces,
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

  const { data: templates, isLoading, isError, refetch } = usePrompts()
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
    <div className="flex w-full max-w-4xl flex-col gap-6">
      <PageHeader
        title="AI Assistant"
        description="Create reusable prompt templates for your AI Assistant. Use variables to personalize content dynamically for each lead."
      />

      {/* Create Template Section */}
      <Card>
        <CardHeader>
          <CardTitle>Create template</CardTitle>
          <CardDescription>
            Name it, write the prompt, and drop in any of the variables below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-template-name">Name</Label>
            <Input
              id="new-template-name"
              placeholder="Template name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={createPrompt.isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-template-prompt">Prompt</Label>
            <Textarea
              id="new-template-prompt"
              placeholder="Write your prompt... Use {name}, {company}, {title} for personalization"
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              rows={6}
              className="font-mono text-sm"
              disabled={createPrompt.isPending}
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Braces className="h-3 w-3" aria-hidden />
                Variables
              </span>
              {VARIABLES.map((v) => (
                <Badge key={v} variant="outline" className="font-mono font-normal">
                  {v}
                </Badge>
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
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Plus className="mr-2 h-4 w-4" aria-hidden />
              )}
              Create Template
            </Button>
          </div>
          {createPrompt.isError && (
            <p role="alert" className="text-sm text-destructive">
              {createPrompt.error.message}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Templates List */}
      <section className="flex flex-col gap-4" aria-labelledby="your-templates">
        <h2 id="your-templates" className="text-lg font-semibold tracking-tight">
          Your templates
          {templates && templates.length > 0 ? (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {templates.length}
            </span>
          ) : null}
        </h2>

        {isError ? (
          <ErrorState
            message="Prompt templates could not be loaded."
            onRetry={() => refetch()}
          />
        ) : isLoading ? (
          <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading templates">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        ) : !templates || templates.length === 0 ? (
          <EmptyState
            icon={BookTemplate}
            title="No prompt templates yet"
            description="Create your first template above."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {templates.map((template) => (
              <Card key={template.id} className="gap-0 py-0">
                {editingId === template.id ? (
                  /* Edit Mode */
                  <div className="space-y-3 p-4">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Template name"
                      aria-label="Template name"
                      disabled={updatePrompt.isPending}
                    />
                    <Textarea
                      value={editPrompt}
                      onChange={(e) => setEditPrompt(e.target.value)}
                      placeholder="Write your prompt..."
                      aria-label="Prompt"
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
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                        ) : (
                          <Check className="mr-2 h-4 w-4" aria-hidden />
                        )}
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancelEdit}
                        disabled={updatePrompt.isPending}
                      >
                        <X className="mr-1 h-4 w-4" aria-hidden />
                        Cancel
                      </Button>
                    </div>
                    {updatePrompt.isError && (
                      <p role="alert" className="text-sm text-destructive">
                        {updatePrompt.error.message}
                      </p>
                    )}
                  </div>
                ) : (
                  /* Display Mode */
                  <div className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-medium leading-tight">
                          {template.name}
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Created {formatDate(template.createdAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handleStartEdit(template)}
                          aria-label={`Edit ${template.name}`}
                        >
                          <Pencil className="h-4 w-4" aria-hidden />
                        </Button>
                        {deleteConfirmId === template.id ? (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-8"
                              onClick={() => handleDelete(template.id)}
                              disabled={deletePrompt.isPending}
                            >
                              {deletePrompt.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                              ) : (
                                "Confirm"
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8"
                              onClick={() => setDeleteConfirmId(null)}
                              disabled={deletePrompt.isPending}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              setDeleteConfirmId(template.id)
                              setEditingId(null)
                            }}
                            aria-label={`Delete ${template.name}`}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </Button>
                        )}
                      </div>
                    </div>

                    <p className="line-clamp-3 whitespace-pre-wrap rounded-md bg-muted/50 px-3 py-2 font-mono text-xs leading-relaxed text-muted-foreground">
                      {template.prompt}
                    </p>
                    {deletePrompt.isError && deleteConfirmId === template.id && (
                      <p role="alert" className="text-sm text-destructive">
                        {deletePrompt.error.message}
                      </p>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
