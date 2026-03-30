"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { SearchType } from "@/generated/prisma/enums"
import { useLists, useCreateList } from "@/hooks/useLists"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface ListSelectorProps {
  value: string | undefined
  onChange: (listId: string) => void
  searchType: SearchType
}

const CREATE_NEW_VALUE = "__create_new__"

export function ListSelector({ value, onChange, searchType }: ListSelectorProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [newListName, setNewListName] = useState("")

  const { data: lists, isLoading: listsLoading } = useLists(searchType)
  const createList = useCreateList()

  function handleSelectChange(val: string) {
    if (val === CREATE_NEW_VALUE) {
      setIsCreating(true)
    } else {
      setIsCreating(false)
      onChange(val)
    }
  }

  async function handleCreateList() {
    if (!newListName.trim()) return
    try {
      const created = await createList.mutateAsync({
        name: newListName.trim(),
        type: searchType,
      })
      setNewListName("")
      setIsCreating(false)
      onChange(created.id)
    } catch {
      // error is handled by the mutation
    }
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">Save to List</Label>
      <Select
        value={isCreating ? CREATE_NEW_VALUE : value || ""}
        onValueChange={handleSelectChange}
      >
        <SelectTrigger className="h-10 w-full rounded-lg border-border transition focus:ring-2 focus:ring-primary/20">
          <SelectValue placeholder={listsLoading ? "Loading lists..." : "Select a list"} />
        </SelectTrigger>
        <SelectContent>
          {lists?.map((list) => (
            <SelectItem key={list.id} value={list.id}>
              {list.name} ({list.leadCount} leads)
            </SelectItem>
          ))}
          <SelectItem value={CREATE_NEW_VALUE}>
            <span className="flex items-center gap-1.5">
              <Plus className="size-3.5" />
              Create new list
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      {isCreating && (
        <div className="flex items-center gap-2 pt-1">
          <Input
            placeholder="New list name"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                handleCreateList()
              }
            }}
            className="h-10 rounded-lg border-border transition focus:ring-2 focus:ring-primary/20"
            autoFocus
          />
          <Button
            type="button"
            size="sm"
            onClick={handleCreateList}
            disabled={!newListName.trim() || createList.isPending}
          >
            {createList.isPending ? "Creating..." : "Create"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setIsCreating(false)}
          >
            Cancel
          </Button>
        </div>
      )}

      {createList.isError && (
        <p className="text-xs text-destructive">{createList.error.message}</p>
      )}
    </div>
  )
}
