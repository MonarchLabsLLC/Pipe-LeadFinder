"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Loader2, MailPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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

type Option = { id: string; name: string }
type MailBaserOptions = { workspaceName: string; lists: Option[]; tags: Option[] }

export type MailBaserPrefs = { listIds: string[]; tagIds: string[] }

function toggle(ids: string[], id: string, checked: boolean): string[] {
  return checked ? [...new Set([...ids, id])] : ids.filter((item) => item !== id)
}

function OptionChecklist({
  heading,
  empty,
  options,
  selected,
  onChange,
}: {
  heading: string
  empty: string
  options: Option[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium">{heading}</legend>
      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <div className="max-h-36 space-y-0.5 overflow-y-auto rounded-md border p-1">
          {options.map((option) => (
            <label
              key={option.id}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
            >
              <Checkbox
                checked={selected.includes(option.id)}
                onCheckedChange={(checked) => onChange(toggle(selected, option.id, checked === true))}
              />
              <span className="truncate">{option.name}</span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  )
}

export function AddToMailBaserButton({
  leadIds,
  size = "xs",
  onSent,
}: {
  leadIds: string[]
  size?: "xs" | "sm"
  onSent?: () => void
}) {
  const userId = useHandoffUserId()
  const key = prefsKey("mailbaser", userId)
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [draft, setDraft] = useState<MailBaserPrefs>({ listIds: [], tagIds: [] })

  const options = useQuery({
    queryKey: ["handoff-options", "mailbaser"],
    queryFn: () => fetchHandoffOptions<MailBaserOptions>("mailbaser"),
    enabled: open,
    staleTime: 60_000,
    retry: false,
  })

  // Only offer ids that still exist, so a deleted list is never sent.
  const known = (ids: string[], list: Option[] | undefined) =>
    list ? ids.filter((id) => list.some((item) => item.id === id)) : ids

  function handleOpenChange(next: boolean) {
    if (next) setDraft(readPrefs<MailBaserPrefs>(key) ?? { listIds: [], tagIds: [] })
    setOpen(next)
  }

  async function send(prefs: MailBaserPrefs) {
    if (leadIds.length === 0 || sending) return
    setSending(true)
    try {
      const result = await sendLeadsInBatches("mailbaser", leadIds, {
        ...(prefs.listIds.length ? { listIds: prefs.listIds } : {}),
        ...(prefs.tagIds.length ? { tagIds: prefs.tagIds } : {}),
      })
      toastHandoffResult("mailbaser", result)
      if (!result.error) onSent?.()
    } catch (error) {
      toastHandoffResult("mailbaser", {
        counts: { created: 0, updated: 0, skipped: 0 },
        openUrl: null,
        error: error instanceof Error ? error.message : "MailBaser could not be reached.",
      })
    } finally {
      setSending(false)
    }
  }

  function handlePrimary() {
    const saved = readPrefs<MailBaserPrefs>(key)
    // First time: ask where the contacts should go. After that: one click.
    if (!saved) handleOpenChange(true)
    else void send(saved)
  }

  function sendWithDraft() {
    const prefs: MailBaserPrefs = {
      listIds: known(draft.listIds, options.data?.lists),
      tagIds: known(draft.tagIds, options.data?.tags),
    }
    writePrefs(key, prefs)
    setOpen(false)
    void send(prefs)
  }

  const count = leadIds.length
  return (
    <HandoffSplitButton
      label="MailBaser"
      icon={<MailPlus />}
      title={`Add ${count === 1 ? "this lead" : `${count} leads`} to MailBaser`}
      size={size}
      sending={sending}
      open={open}
      onOpenChange={handleOpenChange}
      onPrimary={handlePrimary}
    >
      <HandoffPanel
        heading="Add to MailBaser"
        description={
          options.data?.workspaceName
            ? `Leads with an email address become contacts in ${options.data.workspaceName}.`
            : "Leads with an email address become contacts in MailBaser."
        }
        footer={
          <>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={sendWithDraft}
              disabled={count === 0 || options.isLoading || options.isError}
            >
              Add {count === 1 ? "lead" : `${count} leads`}
            </Button>
          </>
        }
      >
        {options.isLoading ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> Loading lists and tags...
          </p>
        ) : options.isError ? (
          <p className="text-xs text-destructive">
            {options.error instanceof Error ? options.error.message : "Lists and tags could not be loaded."}
          </p>
        ) : (
          <>
            <OptionChecklist
              heading="Lists"
              empty="No lists yet."
              options={options.data?.lists ?? []}
              selected={draft.listIds}
              onChange={(listIds) => setDraft((prev) => ({ ...prev, listIds }))}
            />
            <OptionChecklist
              heading="Tags"
              empty="No tags yet."
              options={options.data?.tags ?? []}
              selected={draft.tagIds}
              onChange={(tagIds) => setDraft((prev) => ({ ...prev, tagIds }))}
            />
            <p className="text-xs text-muted-foreground">
              Added as prospects, not subscribers. Your choice is remembered for next time.
            </p>
          </>
        )}
      </HandoffPanel>
    </HandoffSplitButton>
  )
}
