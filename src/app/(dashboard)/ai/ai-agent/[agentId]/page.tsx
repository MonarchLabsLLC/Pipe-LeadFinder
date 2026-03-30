"use client"

import { useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAgent, useUpdateAgent, useRunAgent, type AgentSummary } from "@/hooks/useAgents"
import type { AgentStatus } from "@/generated/prisma/enums"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { ArrowLeft, Save, Play, Plus, X } from "lucide-react"
import { toast } from "sonner"

interface AgentConfig {
  searchType: string
  searchDescription: string
  searchLocation: string
  actions: string[]
  connections: string[]
  schedule: string
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

function statusBadgeClass(status: AgentStatus) {
  switch (status) {
    case "ACTIVE":
      return "bg-green-600 hover:bg-green-600 text-white"
    case "PAUSED":
      return "bg-yellow-500 hover:bg-yellow-500 text-white"
    case "DRAFT":
    default:
      return ""
  }
}

function statusBadgeVariant(status: AgentStatus) {
  switch (status) {
    case "ACTIVE":
      return "default" as const
    case "PAUSED":
      return "secondary" as const
    default:
      return "outline" as const
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
    }
  }
  return defaultConfig
}

export default function AgentBuilderPage() {
  const params = useParams()
  const router = useRouter()
  const agentId = params.agentId as string

  const { data: agent, isLoading } = useAgent(agentId)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground">Agent not found.</p>
        <Button variant="link" onClick={() => router.push("/ai/ai-agent")}>
          Back to Agents
        </Button>
      </div>
    )
  }

  return <AgentBuilderForm key={agent.id + agent.updatedAt} agent={agent} />
}

function AgentBuilderForm({ agent }: { agent: AgentSummary }) {
  const router = useRouter()
  const updateAgent = useUpdateAgent()
  const runAgent = useRunAgent()

  const [name, setName] = useState(agent.name)
  const [config, setConfig] = useState<AgentConfig>(() => parseAgentConfig(agent))
  const [newWebhook, setNewWebhook] = useState("")

  const handleSave = useCallback(() => {
    updateAgent.mutate(
      {
        id: agent.id,
        name: name.trim(),
        config: config as unknown as Record<string, unknown>,
      },
      {
        onSuccess: () => toast.success("Agent saved"),
        onError: (err) => toast.error(err.message),
      }
    )
  }, [agent.id, name, config, updateAgent])

  const handleRun = () => {
    runAgent.mutate(agent.id, {
      onSuccess: (data) => toast.success(data.message || "Agent triggered"),
      onError: (err) => toast.error(err.message),
    })
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
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/ai/ai-agent")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-lg font-semibold border-none shadow-none px-0 focus-visible:ring-0 h-auto"
            placeholder="Agent name"
          />
        </div>
        <Badge
          variant={statusBadgeVariant(agent.status)}
          className={statusBadgeClass(agent.status)}
        >
          {agent.status}
        </Badge>
        <Button variant="outline" onClick={handleSave} disabled={updateAgent.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {updateAgent.isPending ? "Saving..." : "Save"}
        </Button>
        <Button onClick={handleRun} disabled={runAgent.isPending}>
          <Play className="mr-2 h-4 w-4" />
          {runAgent.isPending ? "Running..." : "Run"}
        </Button>
      </div>

      {/* Step 1 - Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              1
            </span>
            Search
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Search Type</Label>
            <Select
              value={config.searchType}
              onValueChange={(val) =>
                setConfig((prev) => ({ ...prev, searchType: val }))
              }
            >
              <SelectTrigger>
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
            <Label>Description</Label>
            <Textarea
              placeholder="e.g., Web Designers in San Francisco"
              value={config.searchDescription}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, searchDescription: e.target.value }))
              }
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>Location</Label>
            <Input
              placeholder="e.g., San Francisco, CA"
              value={config.searchLocation}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, searchLocation: e.target.value }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Step 2 - Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              2
            </span>
            Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Select actions to perform on search results.
          </p>
          {actionOptions.map((opt) => (
            <div key={opt.value} className="flex items-center gap-2">
              <Checkbox
                id={`action-${opt.value}`}
                checked={config.actions.includes(opt.value)}
                onCheckedChange={() => toggleAction(opt.value)}
              />
              <Label htmlFor={`action-${opt.value}`} className="text-sm cursor-pointer">
                {opt.label}
              </Label>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Step 3 - Connections */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              3
            </span>
            Connections
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Add webhook URLs to send results to external services.
          </p>
          {config.connections.map((url, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={url} readOnly className="flex-1 text-sm" />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => removeConnection(i)}
              >
                <X className="h-4 w-4" />
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
            <Button variant="outline" size="sm" onClick={addConnection}>
              <Plus className="mr-1 h-4 w-4" />
              Add Connection
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Step 4 - Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              4
            </span>
            Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={config.schedule}
            onValueChange={(val) =>
              setConfig((prev) => ({ ...prev, schedule: val }))
            }
            className="space-y-2"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="manual" id="schedule-manual" />
              <Label htmlFor="schedule-manual" className="text-sm cursor-pointer">
                Manual
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="daily" id="schedule-daily" />
              <Label htmlFor="schedule-daily" className="text-sm cursor-pointer">
                Daily
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="weekly" id="schedule-weekly" />
              <Label htmlFor="schedule-weekly" className="text-sm cursor-pointer">
                Weekly
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>
    </div>
  )
}
