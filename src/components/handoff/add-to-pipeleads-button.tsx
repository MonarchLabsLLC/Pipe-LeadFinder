"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Loader2, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  fetchHandoffOptions,
  prefsKey,
  readPrefs,
  sendLeadsInBatches,
  toastHandoffResult,
  writePrefs,
} from "./handoff-client"
import { HandoffPanel, HandoffSplitButton } from "./handoff-split-button"
import { useHandoffUserId } from "./use-handoff-status"

type PipeLeadsOptions = {
  workspaceName: string
  pipelines: { id: string; name: string; stages: { id: string; name: string; kind?: "OPEN" | "WON" | "LOST" }[] }[]
  tags: { id: string; name: string }[]
}

export type PipeLeadsPrefs = {
  createDeals: boolean
  pipelineId?: string
  stageId?: string
  tagNames?: string[]
}

const DEFAULT_PREFS: PipeLeadsPrefs = { createDeals: false }

function parseTags(value: string): string[] {
  return [...new Set(value.split(",").map((tag) => tag.trim()).filter(Boolean).map((tag) => tag.slice(0, 50)))].slice(0, 20)
}

export function AddToPipeLeadsButton({
  leadIds,
  size = "xs",
  onSent,
}: {
  leadIds: string[]
  size?: "xs" | "sm"
  onSent?: () => void
}) {
  const userId = useHandoffUserId()
  const key = prefsKey("pipeleads", userId)
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [draft, setDraft] = useState<PipeLeadsPrefs>(DEFAULT_PREFS)
  const [tagText, setTagText] = useState("")

  const options = useQuery({
    queryKey: ["handoff-options", "pipeleads"],
    queryFn: () => fetchHandoffOptions<PipeLeadsOptions>("pipeleads"),
    enabled: open,
    staleTime: 60_000,
    retry: false,
  })

  const pipelines = options.data?.pipelines ?? []
  // A new deal belongs in an open stage, never straight into Won or Lost.
  const stages = (pipelines.find((pipeline) => pipeline.id === draft.pipelineId)?.stages ?? []).filter(
    (stage) => !stage.kind || stage.kind === "OPEN"
  )

  function handleOpenChange(next: boolean) {
    if (next) {
      const saved = readPrefs<PipeLeadsPrefs>(key) ?? DEFAULT_PREFS
      setDraft(saved)
      setTagText((saved.tagNames ?? []).join(", "))
    }
    setOpen(next)
  }

  async function send(prefs: PipeLeadsPrefs) {
    if (leadIds.length === 0 || sending) return
    setSending(true)
    try {
      const result = await sendLeadsInBatches("pipeleads", leadIds, {
        createDeals: prefs.createDeals,
        ...(prefs.createDeals && prefs.pipelineId ? { pipelineId: prefs.pipelineId } : {}),
        ...(prefs.createDeals && prefs.stageId ? { stageId: prefs.stageId } : {}),
        ...(prefs.tagNames?.length ? { tagNames: prefs.tagNames } : {}),
      })
      toastHandoffResult("pipeleads", result)
      if (!result.error) onSent?.()
    } catch (error) {
      toastHandoffResult("pipeleads", {
        counts: { created: 0, updated: 0, skipped: 0 },
        openUrl: null,
        error: error instanceof Error ? error.message : "PipeLeads could not be reached.",
      })
    } finally {
      setSending(false)
    }
  }

  function sendWithDraft() {
    const prefs: PipeLeadsPrefs = { ...draft, tagNames: parseTags(tagText) }
    writePrefs(key, prefs)
    setOpen(false)
    void send(prefs)
  }

  const count = leadIds.length
  return (
    <HandoffSplitButton
      label="PipeLeads"
      icon={<UserPlus />}
      title={`Add ${count === 1 ? "this lead" : `${count} leads`} to PipeLeads CRM`}
      size={size}
      sending={sending}
      open={open}
      onOpenChange={handleOpenChange}
      onPrimary={() => void send(readPrefs<PipeLeadsPrefs>(key) ?? DEFAULT_PREFS)}
    >
      <HandoffPanel
        heading="Add to PipeLeads"
        description={
          options.data?.workspaceName
            ? `Each lead becomes a contact, with its company, in ${options.data.workspaceName}.`
            : "Each lead becomes a contact, with its company, in your CRM."
        }
        footer={
          <>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={sendWithDraft} disabled={count === 0}>
              Add {count === 1 ? "lead" : `${count} leads`}
            </Button>
          </>
        }
      >
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="handoff-create-deal" className="font-normal">
            Also create a deal
          </Label>
          <Switch
            id="handoff-create-deal"
            checked={draft.createDeals}
            onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, createDeals: checked }))}
          />
        </div>

        {draft.createDeals && (
          <div className="space-y-2">
            {options.isLoading ? (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" /> Loading pipelines...
              </p>
            ) : options.isError ? (
              <p className="text-xs text-destructive">
                {options.error instanceof Error ? options.error.message : "Pipelines could not be loaded."}
              </p>
            ) : (
              <>
                <Select
                  value={draft.pipelineId ?? ""}
                  onValueChange={(pipelineId) =>
                    setDraft((prev) => ({ ...prev, pipelineId, stageId: undefined }))
                  }
                >
                  <SelectTrigger size="sm" className="w-full" aria-label="Pipeline">
                    <SelectValue placeholder="Default pipeline" />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelines.map((pipeline) => (
                      <SelectItem key={pipeline.id} value={pipeline.id}>
                        {pipeline.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={draft.stageId ?? ""}
                  onValueChange={(stageId) => setDraft((prev) => ({ ...prev, stageId }))}
                  disabled={!draft.pipelineId}
                >
                  <SelectTrigger size="sm" className="w-full" aria-label="Stage">
                    <SelectValue placeholder="First stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="handoff-pipeleads-tags" className="font-normal">
            Tags
          </Label>
          <Input
            id="handoff-pipeleads-tags"
            className="h-8 text-sm"
            placeholder="e.g. webinar, q4-outreach"
            value={tagText}
            onChange={(event) => setTagText(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">Separate tags with commas.</p>
        </div>
        <p className="text-xs text-muted-foreground">
          These choices are remembered, so the PipeLeads button reuses them next time.
        </p>
      </HandoffPanel>
    </HandoffSplitButton>
  )
}
