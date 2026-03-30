"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useAgents, useCreateAgent, useUpdateAgent, useDeleteAgent } from "@/hooks/useAgents"
import type { AgentStatus } from "@/generated/prisma/enums"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
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
import { Plus, Play, Pause, Trash2, Bot } from "lucide-react"
import { ListCardSkeleton } from "@/components/ui/loading-skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"

type StatusFilter = "ALL" | AgentStatus

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "All Statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "ACTIVE", label: "Active" },
  { value: "PAUSED", label: "Paused" },
]

function statusDotColor(status: AgentStatus) {
  switch (status) {
    case "ACTIVE":
      return "bg-green-500"
    case "PAUSED":
      return "bg-amber-500"
    case "DRAFT":
    default:
      return "bg-gray-400"
  }
}

function statusLabel(status: AgentStatus) {
  switch (status) {
    case "ACTIVE":
      return "Active"
    case "PAUSED":
      return "Paused"
    case "DRAFT":
    default:
      return "Draft"
  }
}

function parseConfigCounts(config: Record<string, unknown> | null) {
  if (!config) return { actions: 0, connections: 0, leads: 0 }
  const actions = Array.isArray(config.actions) ? config.actions.length : 0
  const connections = Array.isArray(config.connections) ? config.connections.length : 0
  const leads = typeof config.leadsCount === "number" ? config.leadsCount : 0
  return { actions, connections, leads }
}

export default function AiAgentPage() {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL")

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [newAutoSave, setNewAutoSave] = useState(false)

  const { data: agents = [], isLoading, isError, refetch } = useAgents(
    statusFilter === "ALL" ? undefined : (statusFilter as AgentStatus)
  )
  const createAgent = useCreateAgent()
  const updateAgent = useUpdateAgent()
  const deleteAgent = useDeleteAgent()

  const filteredAgents = useMemo(() => agents, [agents])

  const handleCreate = () => {
    if (!newName.trim()) return
    createAgent.mutate(
      {
        name: newName.trim(),
        description: newDescription.trim() || undefined,
        autoSave: newAutoSave,
      },
      {
        onSuccess: (agent) => {
          setCreateOpen(false)
          setNewName("")
          setNewDescription("")
          setNewAutoSave(false)
          router.push(`/ai/ai-agent/${agent.id}`)
        },
      }
    )
  }

  const handleToggleStatus = (id: string, currentStatus: AgentStatus) => {
    const newStatus = currentStatus === "ACTIVE" ? "PAUSED" : "ACTIVE"
    updateAgent.mutate({ id, status: newStatus })
  }

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this agent?")) {
      deleteAgent.mutate(id)
    }
  }

  return (
    <div className="space-y-6">
      {/* Toolbar row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground max-w-xl">
          Automated prospecting pipelines that run search, enrichment, and actions.
        </p>
        <div className="flex items-center gap-3">
          <Select
            value={statusFilter}
            onValueChange={(val) => setStatusFilter(val as StatusFilter)}
          >
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setCreateOpen(true)} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            New AI Agent
          </Button>
        </div>
      </div>

      {/* Agent grid */}
      {isError ? (
        <ErrorState
          message="Failed to load AI Agents. Please try again."
          onRetry={() => refetch()}
        />
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ListCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredAgents.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="No AI Agents yet"
          description="Create an AI Agent to automate your prospecting pipelines with search, enrichment, and outreach actions."
          action={{
            label: "Create your first agent",
            onClick: () => setCreateOpen(true),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAgents.map((agent) => {
            const counts = parseConfigCounts(agent.config)
            return (
              <Card
                key={agent.id}
                className="group relative cursor-pointer overflow-hidden rounded-xl transition-all hover:border-primary/40 hover:shadow-md"
                onClick={() => router.push(`/ai/ai-agent/${agent.id}`)}
              >
                {/* Subtle gradient top bar */}
                <div className="h-1 w-full bg-gradient-to-r from-primary/40 via-primary/20 to-transparent" />

                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm leading-tight truncate flex-1">
                      {agent.name}
                    </h3>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`h-2 w-2 rounded-full ${statusDotColor(agent.status)}`} />
                      <span className="text-xs text-muted-foreground font-medium">
                        {statusLabel(agent.status)}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {counts.actions} action{counts.actions !== 1 ? "s" : ""} · {counts.connections} connection{counts.connections !== 1 ? "s" : ""} · {counts.leads} lead{counts.leads !== 1 ? "s" : ""}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    Created {new Date(agent.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>

                  <div className="flex items-center gap-2 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleToggleStatus(agent.id, agent.status)
                      }}
                      title={agent.status === "ACTIVE" ? "Pause" : "Activate"}
                    >
                      {agent.status === "ACTIVE" ? (
                        <Pause className="h-3.5 w-3.5" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(agent.id)
                      }}
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create Agent dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New AI Agent</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="agent-name">Name</Label>
              <Input
                id="agent-name"
                placeholder="My Prospecting Agent"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-description">Description (optional)</Label>
              <Textarea
                id="agent-description"
                placeholder="Describe what this agent does..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="agent-autosave"
                checked={newAutoSave}
                onCheckedChange={(checked) => setNewAutoSave(checked === true)}
              />
              <Label htmlFor="agent-autosave" className="text-sm cursor-pointer">
                Auto-save changes
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newName.trim() || createAgent.isPending}
            >
              {createAgent.isPending ? "Creating..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
