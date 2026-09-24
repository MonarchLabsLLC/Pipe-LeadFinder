"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useAgents, useCreateAgent, useUpdateAgent, useDeleteAgent } from "@/hooks/useAgents"
import type { AgentStatus } from "@/generated/prisma/enums"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import { appToast } from "@/lib/app-toast"

type StatusFilter = "ALL" | AgentStatus

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "All Statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "ACTIVE", label: "Active" },
  { value: "PAUSED", label: "Paused" },
]

/** Same status accents as PipeLeads Suite's workflow list. */
function statusAccent(status: AgentStatus) {
  switch (status) {
    case "ACTIVE":
      return "var(--chart-1)"
    case "PAUSED":
      return "var(--chart-3)"
    case "DRAFT":
    default:
      return "var(--muted-foreground)"
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
  if (!config) return { actions: 0, connections: 0, leads: 0, schedule: "manual" }
  const actions = Array.isArray(config.actions) ? config.actions.length : 0
  const connections = Array.isArray(config.connections) ? config.connections.length : 0
  const leads = typeof config.leadCount === "number" ? config.leadCount : 0
  const schedule = typeof config.schedule === "string" ? config.schedule : "manual"
  return { actions, connections, leads, schedule }
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
        onError: (err) => appToast.error("agentCreate", err),
      }
    )
  }

  const handleToggleStatus = (id: string, currentStatus: AgentStatus) => {
    const newStatus = currentStatus === "ACTIVE" ? "PAUSED" : "ACTIVE"
    updateAgent.mutate(
      { id, status: newStatus },
      { onError: (err) => appToast.error("agentStatus", err) }
    )
  }

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this agent?")) {
      deleteAgent.mutate(id, {
        onError: (err) => appToast.error("agentDelete", err),
      })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="AI Agent"
        description="Automated prospecting pipelines that run search, enrichment, and actions."
        actions={
          <>
            <Select
              value={statusFilter}
              onValueChange={(val) => setStatusFilter(val as StatusFilter)}
            >
              <SelectTrigger className="w-40" aria-label="Filter by status">
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
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              New AI Agent
            </Button>
          </>
        }
      />

      {/* Agent grid */}
      {isError ? (
        <ErrorState
          message="Failed to load AI Agents. Please try again."
          onRetry={() => refetch()}
        />
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading agents">
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredAgents.map((agent) => {
            const counts = parseConfigCounts(agent.config)
            const accent = statusAccent(agent.status)
            return (
              <Card
                key={agent.id}
                className="cursor-pointer gap-0 p-0 transition-colors hover:border-primary/40"
                onClick={() => router.push(`/ai/ai-agent/${agent.id}`)}
              >
                <div className="flex items-start gap-3 p-4">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: `color-mix(in oklch, ${accent} 16%, var(--card))`,
                      color: accent,
                    }}
                  >
                    <Bot className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="truncate font-medium leading-tight">
                        {agent.name}
                      </h3>
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        {statusLabel(agent.status)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {counts.actions} action{counts.actions !== 1 ? "s" : ""} · {counts.connections} connection{counts.connections !== 1 ? "s" : ""} · {counts.leads} lead{counts.leads !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t px-4 py-3">
                  <p className="min-w-0 truncate text-xs text-muted-foreground">
                    <span className="capitalize">{counts.schedule}</span> schedule · Created{" "}
                    {new Date(agent.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleToggleStatus(agent.id, agent.status)
                      }}
                      title={agent.status === "ACTIVE" ? "Pause" : "Activate"}
                      aria-label={agent.status === "ACTIVE" ? `Pause ${agent.name}` : `Activate ${agent.name}`}
                    >
                      {agent.status === "ACTIVE" ? (
                        <Pause className="h-4 w-4" aria-hidden />
                      ) : (
                        <Play className="h-4 w-4" aria-hidden />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(agent.id)
                      }}
                      title="Delete"
                      aria-label={`Delete ${agent.name}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
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
              <Label htmlFor="agent-autosave" className="cursor-pointer font-normal">
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
