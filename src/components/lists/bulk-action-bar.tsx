"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import type { SearchType } from "@/generated/prisma/enums"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useLabels } from "@/hooks/useLabels"
import { useLists } from "@/hooks/useLists"
import { useBulkAction, type BulkAction } from "@/hooks/useBulkActions"
import { appToast } from "@/lib/app-toast"
import { Copy, FileDown, Mail, MapPinCheck, Phone, Send, Tags, Trash2, WandSparkles } from "lucide-react"

interface IntegrationOption {
  id: string
  name: string
}

export function BulkActionBar({
  listId,
  listType,
  entryIds,
  onClear,
  onJobQueued,
}: {
  listId: string
  listType: SearchType
  entryIds: string[]
  onClear: () => void
  onJobQueued: (jobId: string) => void
}) {
  const [labelId, setLabelId] = useState("")
  const [targetListId, setTargetListId] = useState("")
  const [integrationId, setIntegrationId] = useState("")
  const { data: labels = [] } = useLabels()
  const { data: lists = [] } = useLists(listType)
  const bulk = useBulkAction()
  const integrations = useQuery({
    queryKey: ["integrations"],
    queryFn: async (): Promise<IntegrationOption[]> => {
      const response = await fetch("/api/integrations")
      if (!response.ok) throw new Error("Integrations could not be loaded")
      return response.json()
    },
  })

  async function run(action: BulkAction, options?: { labelId?: string; targetListId?: string }) {
    try {
      const result = await bulk.mutateAsync({ listId, entryIds, action, options })
      if (result.jobId) {
        onJobQueued(result.jobId)
        appToast.success("Bulk operation queued", `${entryIds.length} selected leads will be processed.`)
      } else {
        appToast.success("Bulk action complete", `${entryIds.length} selected leads were updated.`)
        onClear()
      }
    } catch (error) {
      appToast.error("bulkAction", error)
    }
  }

  async function sendToIntegration() {
    if (!integrationId) return
    try {
      const response = await fetch(`/api/integrations/${integrationId}/deliver`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ listId, entryIds }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Delivery could not be queued")
      onJobQueued(result.jobId)
      appToast.success("Delivery queued", `${entryIds.length} selected leads will be sent securely.`)
    } catch (error) {
      appToast.error("bulkAction", error)
    }
  }

  async function exportScaleMail() {
    try {
      const response = await fetch(`/api/lists/${listId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryIds }),
      })
      if (!response.ok) throw new Error(await response.text())
      const url = URL.createObjectURL(await response.blob())
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = "scalemail-contacts.csv"
      anchor.click()
      URL.revokeObjectURL(url)
      appToast.success("ScaleMail CSV ready", `${entryIds.length} selected leads were exported.`)
    } catch (error) {
      appToast.error("exportCsv", error)
    }
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3">
      <span className="mr-1 text-sm font-medium">{entryIds.length} selected</span>
      <Button size="sm" variant="outline" disabled={bulk.isPending} onClick={() => run("ENRICH_EMAIL")}>
        <Mail className="size-3.5" /> Email
      </Button>
      <Button size="sm" variant="outline" disabled={bulk.isPending} onClick={() => run("ENRICH_PHONE")}>
        <Phone className="size-3.5" /> Phone
      </Button>
      <Button size="sm" variant="outline" disabled={bulk.isPending} onClick={() => run("SCORE")}>
        <WandSparkles className="size-3.5" /> Score
      </Button>

      <Select value={labelId} onValueChange={setLabelId}>
        <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Choose label" /></SelectTrigger>
        <SelectContent>
          {labels.map((label) => <SelectItem key={label.id} value={label.id}>{label.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button size="sm" variant="outline" disabled={!labelId || bulk.isPending} onClick={() => run("APPLY_LABEL", { labelId })}>
        <Tags className="size-3.5" /> Apply
      </Button>

      <Select value={targetListId} onValueChange={setTargetListId}>
        <SelectTrigger className="h-8 w-44"><SelectValue placeholder="Destination list" /></SelectTrigger>
        <SelectContent>
          {lists.filter((list) => list.id !== listId).map((list) => (
            <SelectItem key={list.id} value={list.id}>{list.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" variant="outline" disabled={!targetListId || bulk.isPending} onClick={() => run("COPY", { targetListId })}>
        <Copy className="size-3.5" /> Copy
      </Button>
      <Button size="sm" variant="outline" disabled={!targetListId || bulk.isPending} onClick={() => run("MOVE", { targetListId })}>
        <MapPinCheck className="size-3.5" /> Move
      </Button>
      <Button size="sm" variant="destructive" disabled={bulk.isPending} onClick={() => run("REMOVE")}>
        <Trash2 className="size-3.5" /> Remove
      </Button>
      <Button size="sm" variant="outline" disabled={bulk.isPending} onClick={exportScaleMail}>
        <FileDown className="size-3.5" /> ScaleMail CSV
      </Button>
      {(integrations.data?.length ?? 0) > 0 && (
        <>
          <Select value={integrationId} onValueChange={setIntegrationId}>
            <SelectTrigger className="h-8 w-44"><SelectValue placeholder="Webhook" /></SelectTrigger>
            <SelectContent>
              {integrations.data?.map((integration) => (
                <SelectItem key={integration.id} value={integration.id}>{integration.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" disabled={!integrationId || bulk.isPending} onClick={sendToIntegration}>
            <Send className="size-3.5" /> Send
          </Button>
        </>
      )}
      <Button className="ml-auto" size="sm" variant="ghost" onClick={onClear}>Clear</Button>
    </div>
  )
}
