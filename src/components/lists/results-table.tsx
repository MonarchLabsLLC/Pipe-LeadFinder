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

interface ResultsTableProps {
  leads: LeadData[]
}

export function ResultsTable({ leads }: ResultsTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

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
    <div className="rounded-md border overflow-x-auto">
      <Table className="min-w-[900px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">
              <Checkbox
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={toggleAll}
                aria-label="Select all"
              />
            </TableHead>
            <TableHead className="min-w-[220px]">Name</TableHead>
            <TableHead className="min-w-[160px]">AI Assistant</TableHead>
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
            />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
