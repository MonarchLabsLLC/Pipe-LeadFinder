"use client"

import { useState, useMemo } from "react"
import { SearchType } from "@/generated/prisma/enums"
import { useLists, useCreateList, useUpdateList, useDeleteList } from "@/hooks/useLists"
import { ListCard } from "@/components/lists/list-card"
import { ListFilters, type FilterValue } from "@/components/lists/list-filters"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Bookmark, LayoutGrid, List, Plus, Search, SearchX } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { ListCardSkeleton } from "@/components/ui/loading-skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { cn } from "@/lib/utils"
import { appToast } from "@/lib/app-toast"

const searchTypeOptions: { value: SearchType; label: string }[] = [
  { value: "PEOPLE" as SearchType, label: "People" },
  { value: "LOCAL" as SearchType, label: "Local" },
  { value: "COMPANY" as SearchType, label: "Company" },
  { value: "DOMAIN" as SearchType, label: "Domain" },
  { value: "INFLUENCER" as SearchType, label: "Influencer" },
]

export default function SavedListsPage() {
  const [activeFilter, setActiveFilter] = useState<FilterValue>("ALL")
  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | "ARCHIVED">("ACTIVE")
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newType, setNewType] = useState<SearchType>("PEOPLE" as SearchType)

  // Rename dialog state
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameId, setRenameId] = useState("")
  const [renameName, setRenameName] = useState("")

  // Fetch all lists for the current status (unfiltered by type so we can compute counts)
  const { data: allLists = [], isLoading, isError, refetch } = useLists(undefined, statusFilter)

  const createList = useCreateList()
  const updateList = useUpdateList()
  const deleteList = useDeleteList()

  // Compute counts per type from the full list
  const counts = useMemo(() => {
    const c: Record<FilterValue, number> = {
      ALL: allLists.length,
      PEOPLE: 0,
      LOCAL: 0,
      COMPANY: 0,
      DOMAIN: 0,
      INFLUENCER: 0,
    }
    for (const list of allLists) {
      c[list.type as FilterValue] = (c[list.type as FilterValue] || 0) + 1
    }
    return c
  }, [allLists])

  // Filter lists by type and search query
  const filteredLists = useMemo(() => {
    let lists = allLists
    if (activeFilter !== "ALL") {
      lists = lists.filter((l) => l.type === activeFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      lists = lists.filter((l) => l.name.toLowerCase().includes(q))
    }
    return lists
  }, [allLists, activeFilter, searchQuery])

  const handleCreate = () => {
    if (!newName.trim()) return
    createList.mutate(
      { name: newName.trim(), type: newType },
      {
        onSuccess: () => {
          setCreateOpen(false)
          setNewName("")
          setNewType("PEOPLE" as SearchType)
        },
        onError: (err) => appToast.error("listCreate", err),
      }
    )
  }

  const handleRename = () => {
    if (!renameName.trim()) return
    updateList.mutate(
      { id: renameId, name: renameName.trim() },
      {
        onSuccess: () => {
          setRenameOpen(false)
          setRenameId("")
          setRenameName("")
        },
        onError: (err) => appToast.error("listRename", err),
      }
    )
  }

  const handleArchive = (id: string) => {
    updateList.mutate(
      {
        id,
        status: statusFilter === "ACTIVE" ? "ARCHIVED" : "ACTIVE",
      },
      { onError: (err) => appToast.error("listStatus", err) }
    )
  }

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this list?")) {
      deleteList.mutate(id, {
        onError: (err) => appToast.error("listDelete", err),
      })
    }
  }

  const openRenameDialog = (id: string) => {
    const list = allLists.find((l) => l.id === id)
    if (list) {
      setRenameId(id)
      setRenameName(list.name)
      setRenameOpen(true)
    }
  }

  const segment = (active: boolean) =>
    cn(
      "h-full rounded-md px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
      active
        ? "bg-background text-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground"
    )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Saved lists"
        description="Every search saves its leads to a list you can enrich, score and send on."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 size-4" aria-hidden />
            Create New
          </Button>
        }
      />

      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1 sm:max-w-72">
            <label htmlFor="saved-lists-search" className="sr-only">
              Search lists
            </label>
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="saved-lists-search"
              type="search"
              placeholder="Search lists..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>

          <div
            role="group"
            aria-label="Show lists"
            className="inline-flex h-9 shrink-0 items-center rounded-lg bg-muted p-[3px]"
          >
            <button
              type="button"
              aria-pressed={statusFilter === "ACTIVE"}
              onClick={() => setStatusFilter("ACTIVE")}
              className={segment(statusFilter === "ACTIVE")}
            >
              Active
            </button>
            <button
              type="button"
              aria-pressed={statusFilter === "ARCHIVED"}
              onClick={() => setStatusFilter("ARCHIVED")}
              className={segment(statusFilter === "ARCHIVED")}
            >
              Archived
            </button>
          </div>

          <div
            role="group"
            aria-label="Layout"
            className="ml-auto inline-flex h-9 shrink-0 items-center rounded-lg bg-muted p-[3px]"
          >
            <button
              type="button"
              aria-pressed={viewMode === "grid"}
              aria-label="Grid view"
              onClick={() => setViewMode("grid")}
              className={cn(segment(viewMode === "grid"), "flex w-8 items-center justify-center px-0")}
            >
              <LayoutGrid className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              aria-pressed={viewMode === "list"}
              aria-label="List view"
              onClick={() => setViewMode("list")}
              className={cn(segment(viewMode === "list"), "flex w-8 items-center justify-center px-0")}
            >
              <List className="size-4" aria-hidden />
            </button>
          </div>
        </div>

        <ListFilters
          counts={counts}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
        />
      </div>

      {/* List grid / list */}
      {isError ? (
        <ErrorState
          title="We could not load your saved lists"
          message="Check your connection and try again."
          onRetry={() => refetch()}
        />
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <ListCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredLists.length === 0 ? (
        allLists.length === 0 ? (
          <EmptyState
            icon={Bookmark}
            title="No saved lists yet"
            description="Run your first search to create a list of leads you can organize, enrich, and export."
            action={{
              label: "Run your first search",
              onClick: () => {
                window.location.href = "/lead-search/new-search"
              },
            }}
          />
        ) : (
          <EmptyState
            icon={SearchX}
            title="No lists match that search"
            description="Try a shorter search or another type, or clear the filters to see every list."
          />
        )
      ) : (
        <div
          className={
            viewMode === "grid"
              ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              : "flex flex-col gap-3"
          }
        >
          {filteredLists.map((list) => (
            <ListCard
              key={list.id}
              id={list.id}
              name={list.name}
              type={list.type}
              leadCount={list.leadCount}
              emailFoundCount={list.emailFoundCount}
              createdAt={list.createdAt}
              onRename={openRenameDialog}
              onArchive={handleArchive}
              onDelete={handleDelete}
              archived={statusFilter === "ARCHIVED"}
            />
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New List</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="list-name">Name</Label>
              <Input
                id="list-name"
                placeholder="My Lead List"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="list-type">Type</Label>
              <Select
                value={newType}
                onValueChange={(val) => setNewType(val as SearchType)}
              >
                <SelectTrigger id="list-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {searchTypeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newName.trim() || createList.isPending}
            >
              {createList.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename List</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="rename-input">Name</Label>
            <Input
              id="rename-input"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRename}
              disabled={!renameName.trim() || updateList.isPending}
            >
              {updateList.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
