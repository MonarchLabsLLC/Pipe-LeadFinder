"use client"

import { useState } from "react"
import { Plus, Sparkles } from "lucide-react"
import { SearchType } from "@/generated/prisma/enums"
import { useLists, useCreateList } from "@/hooks/useLists"
import { AUTO_LIST_ID } from "@/lib/search-summary"
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
  /** The name "New list (auto-named)" will get, previewed under the select. */
  autoName?: string
}

const CREATE_NEW_VALUE = "__create_new__"

const SEARCH_TYPE_LABELS: Record<SearchType, string> = {
  PEOPLE: "People",
  LOCAL: "Local",
  COMPANY: "Company",
  DOMAIN: "Domain",
  INFLUENCER: "Influencer",
}

/**
 * Where results are saved. Defaults to "New list (auto-named)": the page
 * creates a list named from the criteria when the search is submitted, so
 * nobody has to make a list first. Existing lists (of the same search type —
 * the server rejects a mismatch) are one click away.
 */
export function ListSelector({ value, onChange, searchType, autoName }: ListSelectorProps) {
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
      // useCreateList waits for the refreshed options before resolving, which
      // lets Radix retain this controlled value. Select after its create mode
      // has committed so Radix cannot replace the new ID with the closing
      // sentinel value in the same render batch.
      setTimeout(() => onChange(created.id), 0)
    } catch {
      // error is handled by the mutation
    }
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">Save results to</Label>
      <Select
        value={isCreating ? CREATE_NEW_VALUE : value || ""}
        onValueChange={handleSelectChange}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={listsLoading ? "Loading lists..." : "Select a list"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={AUTO_LIST_ID}>
            <span className="flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-primary" />
              New list (auto-named)
            </span>
          </SelectItem>
          {lists?.map((list) => (
            <SelectItem key={list.id} value={list.id}>
              {list.name} ({list.leadCount} leads) - {SEARCH_TYPE_LABELS[list.type]}
            </SelectItem>
          ))}
          <SelectItem value={CREATE_NEW_VALUE}>
            <span className="flex items-center gap-1.5">
              <Plus className="size-3.5" />
              New list with my own name
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

      {!isCreating && value === AUTO_LIST_ID && (
        <p className="text-xs text-muted-foreground">
          {autoName ? (
            <>
              Results go to a new list called{" "}
              <span className="font-medium text-foreground">{autoName}</span>.
            </>
          ) : (
            "Results go to a new list named after your search."
          )}
        </p>
      )}

      {createList.isError && (
        <p className="text-xs text-destructive">{createList.error.message}</p>
      )}
    </div>
  )
}
