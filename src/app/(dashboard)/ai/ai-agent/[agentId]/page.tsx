"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAgent, useUpdateAgent, useRunAgent, type AgentSummary } from "@/hooks/useAgents"
import type { AgentStatus } from "@/generated/prisma/enums"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { appToast } from "@/lib/app-toast"
import { JobProgressBanner } from "@/components/jobs/job-progress-banner"
import { useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Bot, Save, Play, Plus, X } from "lucide-react"

interface AgentConfig {
  searchType: string
  searchDescription: string
  searchLocation: string
  actions: string[]
  connections: string[]
  schedule: string
  resultsLimit?: number
  listId?: string
  leadCount?: number
  lastScheduledRunAt?: string | null
  nextScheduledRunAt?: string | null
  lastScheduledStatus?: "running" | "completed" | "failed" | null
  lastScheduledError?: string | null
  schedulerLockAt?: string | null
}

const defaultConfig: AgentConfig = {
  searchType: "PEOPLE",
  searchDescription: "",
  searchLocation: "",
  actions: [],
  connections: [],
  schedule: "manual",
}

const searchTypeOptions = [
  { value: "PEOPLE", label: "People Search" },
  { value: "LOCAL", label: "Local Business Search" },
  { value: "COMPANY", label: "Company Search" },
  { value: "DOMAIN", label: "Domain Search" },
  { value: "INFLUENCER", label: "Influencer Search" },
]

const actionOptions = [
  { value: "enrich_email", label: "Enrich Email" },
  { value: "enrich_phone", label: "Enrich Phone" },
  { value: "ai_summary", label: "AI Summary" },
  { value: "ai_direct_message", label: "AI Direct Message" },
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

function parseAgentConfig(agent: AgentSummary): AgentConfig {
  if (agent.config && typeof agent.config === "object") {
    const c = agent.config as Record<string, unknown>
    return {
      searchType: (c.searchType as string) || defaultConfig.searchType,
      searchDescription: (c.searchDescription as string) || "",
      searchLocation: (c.searchLocation as string) || "",
      actions: Array.isArray(c.actions) ? (c.actions as string[]) : [],
      connections: Array.isArray(c.connections) ? (c.connections as string[]) : [],
      schedule: (c.schedule as string) || "manual",
      resultsLimit: typeof c.resultsLimit === "number" ? c.resultsLimit : undefined,
      listId: typeof c.listId === "string" ? c.listId : undefined,
      leadCount: typeof c.leadCount === "number" ? c.leadCount : undefined,
      lastScheduledRunAt:
        typeof c.lastScheduledRunAt === "string" ? c.lastScheduledRunAt : null,
      nextScheduledRunAt:
        typeof c.nextScheduledRunAt === "string" ? c.nextScheduledRunAt : null,
      lastScheduledStatus:
        c.lastScheduledStatus === "running" ||
        c.lastScheduledStatus === "completed" ||
        c.lastScheduledStatus === "failed"
          ? c.lastScheduledStatus
          : null,
      lastScheduledError:
        typeof c.lastScheduledError === "string" ? c.lastScheduledError : null,
      schedulerLockAt:
        typeof c.schedulerLockAt === "string" ? c.schedulerLockAt : null,
    }
  }
  return defaultConfig
}

export default function AgentBuilderPage() {
  const params = useParams()
  const router = useRouter()
  const agentId = params.agentId as string

  const { data: agent, isLoading, isError, refetch } = useAgent(agentId)

  if (isLoading) {
    return (
      <div className="flex w-full max-w-3xl flex-col gap-6" aria-busy="true" aria-label="Loading agent">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  if (isError) {
    return (
      <ErrorState
        title="We could not load this agent"
        message="Failed to load this agent."
        onRetry={() => refetch()}
      />
    )
  }

  if (!agent) {
    return (
      <EmptyState
        icon={Bot}
        title="Agent not found"
        description="It may have been deleted, or it belongs to another workspace."
        action={{
          label: "Back to Agents",
          onClick: () => router.push("/ai/ai-agent"),
        }}
      />
    )
  }

  return <AgentBuilderForm key={agent.id + agent.updatedAt} agent={agent} />
}

// ---------------------------------------------------------------------------
// Step Badge + Connector
// ---------------------------------------------------------------------------

function StepBadge({ number }: { number: number }) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
      {number}
    </span>
  )
}

function StepCard({
  number,
  title,
  description,
  children,
}: {
  number: number
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3">
        <StepBadge number={number} />
        <div className="min-w-0 space-y-1.5 pt-1">
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
      </CardHeader>
      <CardContent className="sm:pl-16">{children}</CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Builder Form
// ---------------------------------------------------------------------------

function AgentBuilderForm({ agent }: { agent: AgentSummary }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const updateAgent = useUpdateAgent()
  const runAgent = useRunAgent()
  const updateAgentMutate = updateAgent.mutate

  const [name, setName] = useState(agent.name)
  const [config, setConfig] = useState<AgentConfig>(() => parseAgentConfig(agent))
  const [newWebhook, setNewWebhook] = useState("")
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const savedSignatureRef = useRef(
    JSON.stringify({ name: agent.name, config: parseAgentConfig(agent) })
  )

  useEffect(() => {
    if (!agent.autoSave || !name.trim()) return
    const signature = JSON.stringify({ name: name.trim(), config })
    if (signature === savedSignatureRef.current) return

    const timeout = setTimeout(() => {
      updateAgentMutate(
        {
          id: agent.id,
          name: name.trim(),
          config: config as unknown as Record<string, unknown>,
        },
        {
          onSuccess: () => {
            savedSignatureRef.current = signature
          },
          onError: (err) => appToast.error("agentAutoSave", err),
        }
      )
    }, 800)

    return () => clearTimeout(timeout)
  }, [agent.autoSave, agent.id, config, name, updateAgentMutate])

  const handleSave = useCallback(() => {
    updateAgent.mutate(
      {
        id: agent.id,
        name: name.trim(),
        config: config as unknown as Record<string, unknown>,
      },
      {
        onSuccess: () => {
          savedSignatureRef.current = JSON.stringify({
            name: name.trim(),
            config,
          })
          appToast.success(
            "Agent saved",
            "Your prospecting workflow is up to date."
          )
        },
        onError: (err) => appToast.error("agentSave", err),
      }
    )
  }, [agent.id, name, config, updateAgent])

  const handleRun = async () => {
    if (!name.trim()) return
    try {
      await updateAgent.mutateAsync({
        id: agent.id,
        name: name.trim(),
        config: config as unknown as Record<string, unknown>,
      })
      savedSignatureRef.current = JSON.stringify({ name: name.trim(), config })
      const data = await runAgent.mutateAsync(agent.id)
      setActiveJobId(data.jobId)
      appToast.success(
        "Agent queued",
        "The workflow will continue safely in the background."
      )
    } catch (err) {
      appToast.error("agentRun", err)
    }
  }

  const toggleAction = (action: string) => {
    setConfig((prev) => ({
      ...prev,
      actions: prev.actions.includes(action)
        ? prev.actions.filter((a) => a !== action)
        : [...prev.actions, action],
    }))
  }

  const addConnection = () => {
    const url = newWebhook.trim()
    if (!url) return
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        throw new Error("Unsupported protocol")
      }
    } catch {
      appToast.error("agentWebhook", new Error("Enter a valid HTTP or HTTPS webhook URL"))
      return
    }
    if (config.connections.includes(url)) return
    setConfig((prev) => ({
      ...prev,
      connections: [...prev.connections, url],
    }))
    setNewWebhook("")
  }

  const removeConnection = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      connections: prev.connections.filter((_, i) => i !== index),
    }))
  }

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit text-muted-foreground"
          onClick={() => router.push("/ai/ai-agent")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
          Back to AI Agents
        </Button>
        <PageHeader
          title={
            <span className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 break-words">{name.trim() || "Untitled agent"}</span>
              <Badge variant="outline" className="gap-1.5 text-xs font-medium">
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: statusAccent(agent.status) }}
                />
                {statusLabel(agent.status)}
              </Badge>
            </span>
          }
          description="What this agent searches for, what it does with the results, and when it runs."
          actions={
            <>
              <Button variant="outline" onClick={handleSave} disabled={updateAgent.isPending || !name.trim()}>
                <Save className="mr-2 h-4 w-4" aria-hidden />
                {updateAgent.isPending ? "Saving..." : "Save"}
              </Button>
              <Button onClick={handleRun} disabled={runAgent.isPending || updateAgent.isPending || !name.trim()}>
                <Play className="mr-2 h-4 w-4" aria-hidden />
                {runAgent.isPending ? "Running..." : "Run"}
              </Button>
            </>
          }
        />
      </div>

      <JobProgressBanner
        jobId={activeJobId}
        onComplete={() => {
          void queryClient.invalidateQueries({ queryKey: ["agents", agent.id] })
          void queryClient.invalidateQueries({ queryKey: ["lists"] })
        }}
      />

      <Card>
        <CardContent className="space-y-2">
          <Label htmlFor="agent-name">Agent name</Label>
          <Input
            id="agent-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Agent name"
          />
        </CardContent>
      </Card>

      {/* Step 1 - Search */}
      <StepCard number={1} title="Search" description="Who this agent looks for.">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="agent-search-type">Search Type</Label>
            <Select
              value={config.searchType}
              onValueChange={(val) =>
                setConfig((prev) => ({ ...prev, searchType: val }))
              }
            >
              <SelectTrigger id="agent-search-type" className="w-full">
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
          <div className="space-y-2">
            <Label htmlFor="agent-search-description">Description</Label>
            <Textarea
              id="agent-search-description"
              placeholder="e.g., Web Designers in San Francisco"
              value={config.searchDescription}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, searchDescription: e.target.value }))
              }
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-search-location">Location</Label>
            <Input
              id="agent-search-location"
              placeholder="e.g., San Francisco, CA"
              value={config.searchLocation}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, searchLocation: e.target.value }))
              }
            />
          </div>
        </div>
      </StepCard>

      {/* Step 2 - Actions */}
      <StepCard number={2} title="Actions" description="Select actions to perform on search results.">
        <div className="space-y-3">
          {actionOptions.map((opt) => (
            <div key={opt.value} className="flex items-center gap-2">
              <Checkbox
                id={`action-${opt.value}`}
                checked={config.actions.includes(opt.value)}
                onCheckedChange={() => toggleAction(opt.value)}
              />
              <Label htmlFor={`action-${opt.value}`} className="cursor-pointer font-normal">
                {opt.label}
              </Label>
            </div>
          ))}
        </div>
      </StepCard>

      {/* Step 3 - Connections */}
      <StepCard number={3} title="Connections" description="Add webhook URLs to send results to external services.">
        <div className="space-y-3">
          {config.connections.map((url, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={url} readOnly aria-label={`Webhook ${i + 1}`} className="flex-1 bg-muted/50" />
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeConnection(i)}
                aria-label={`Remove webhook ${i + 1}`}
              >
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Input
              placeholder="https://webhook.example.com/..."
              value={newWebhook}
              onChange={(e) => setNewWebhook(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addConnection()}
              className="flex-1"
            />
            <Button variant="outline" onClick={addConnection} className="shrink-0">
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              Add
            </Button>
          </div>
        </div>
      </StepCard>

      {/* Step 4 - Schedule */}
      <StepCard number={4} title="Schedule" description="Run it yourself, or on a repeating schedule.">
        <RadioGroup
          value={config.schedule}
          onValueChange={(val) =>
            setConfig((prev) => ({ ...prev, schedule: val }))
          }
          className="space-y-2"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="manual" id="schedule-manual" />
            <Label htmlFor="schedule-manual" className="cursor-pointer font-normal">
              Manual
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="daily" id="schedule-daily" />
            <Label htmlFor="schedule-daily" className="cursor-pointer font-normal">
              Daily
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="weekly" id="schedule-weekly" />
            <Label htmlFor="schedule-weekly" className="cursor-pointer font-normal">
              Weekly
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="monthly" id="schedule-monthly" />
            <Label htmlFor="schedule-monthly" className="cursor-pointer font-normal">
              Monthly
            </Label>
          </div>
        </RadioGroup>
      </StepCard>
    </div>
  )
}
