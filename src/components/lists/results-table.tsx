"use client"

import { useState, useCallback } from "react"
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { LeadRow, type LeadData } from "@/components/leads/lead-row"
import type { SearchType } from "@/generated/prisma/enums"
import { BulkActionBar } from "@/components/lists/bulk-action-bar"
import { useHandoffStatus } from "@/components/handoff/use-handoff-status"

interface ResultsTableProps {
  leads: LeadData[]
  listId: string
  listType: SearchType
  onJobQueued: (jobId: string) => void
}

export function ResultsTable({ leads, listId, listType, onJobQueued }: ResultsTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const handoff = useHandoffStatus()
  const showHandoff = handoff.pipeleads || handoff.mailbaser

  const allSelected = leads.length > 0 && selectedIds.size === leads.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < leads.length

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(leads.map((l) => l.id)))
    }
  }, [allSelected, leads])

  const toggleOne = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }, [])

  return (
    <div className="flex flex-col gap-3">
      {selectedIds.size > 0 && (
        <BulkActionBar
          listId={listId}
          listType={listType}
          entryIds={leads
            .filter((lead) => selectedIds.has(lead.id))
            .map((lead) => lead.entryId)}
          leadIds={leads.filter((lead) => selectedIds.has(lead.id)).map((lead) => lead.id)}
          onClear={() => setSelectedIds(new Set())}
          onJobQueued={onJobQueued}
        />
      )}
      <div className="overflow-hidden rounded-md border bg-card">
      <Table className="min-w-[900px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[40px]">
              <Checkbox
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={toggleAll}
                aria-label="Select all"
              />
            </TableHead>
            <TableHead className="min-w-[220px]">Name</TableHead>
            <TableHead className="min-w-[190px]">Lead Score</TableHead>
            <TableHead className="min-w-[160px]">AI Assistant</TableHead>
            {showHandoff && <TableHead className="min-w-[140px]">Send to</TableHead>}
            <TableHead className="min-w-[200px]">Contact Info</TableHead>
            <TableHead className="min-w-[160px]">Company</TableHead>
            <TableHead className="min-w-[140px]">Custom Labels</TableHead>
            <TableHead className="min-w-[100px]">Created At</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
            <LeadRow
              key={lead.id}
              lead={lead}
              selected={selectedIds.has(lead.id)}
              onSelectChange={(checked) => toggleOne(lead.id, checked)}
              showHandoff={showHandoff}
            />
          ))}
        </TableBody>
      </Table>
      </div>
    </div>
  )
}
