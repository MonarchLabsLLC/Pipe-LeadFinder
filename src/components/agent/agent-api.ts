/**
 * Browser side of the Lead Finder Agent API (/api/focused-agent/*): types and
 * the fetch helper shared by the new-search front door and the docked panel.
 */

export type AgentAccess = {
  userId: string
  workspaceId: string
  writesEnabled: boolean
  handoffEnabled?: boolean
  proMax?: boolean
  development?: boolean
}

export type AgentResource = {
  id: string
  name: string
  status: string
  type: string
  url: string
}

export type AgentThread = {
  id: string
  title: string
  resourceIds: string[]
  updatedAt?: string
}

export type AgentQuestion = {
  question: string
  options: string[]
  allowOther: boolean
}

export type AgentMessage = {
  id: string
  role: string
  content: string
  createdAt: string
  metadata?: {
    kind?: string
    lead?: string
    question?: AgentQuestion
  } | null
}

export type LeadPreview = {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  company: string | null
  title: string | null
}

export type ResultSummary = {
  list: { id: string; name: string; type: string; url: string }
  found: number | null
  total: number
  withEmail: number
  withoutEmail: number
  withPhone: number
  sample: LeadPreview[]
}

export type AgentApproval = {
  id: string
  action?: string
  threadId?: string | null
  createdAt?: string
  status: string
  proposalHash: string
  preview: {
    kind?: "search" | "enrich" | "score" | "label" | "handoff" | "agent"
    searchType?: string
    field?: "email" | "phone"
    target?: "pipeleads" | "mailbaser"
    title: string
    before: unknown
    after?: unknown
    cost: {
      maximumCredits?: number
      creditsPerUnit?: number
      maximumUnits?: number
      note?: string
      model?: string
    }
    skipped?: { id: string; name: string | null; reason: string }[]
    eligibleCount?: number
    list: { id: string | null; name: string; url: string | null; isNew?: boolean }
    destination?: {
      createDeals?: boolean
      pipeline?: { name: string } | null
      stage?: { name: string } | null
      workspaceName?: string | null
      lists?: { name: string }[]
      tagNames?: string[]
    }
    label?: { name: string }
    schedule?: string
    effects: string[]
  }
  expiresAt: string
  result?: {
    url?: string
    error?: string
    listId?: string
    counts?: Record<string, number>
    openUrl?: string | null
    changed?: number
  } | null
  job?: {
    stage?: string | null
    status?: string
    progress?: { percent: number; current: number; total: number }
    error?: { code: string; message: string } | null
    result?: unknown
  } | null
  summary?: ResultSummary | null
}

export type AgentRun = {
  runId: string
  threadId: string
  status: string
  error?: string | null
}

export type AgentState = {
  userId: string
  workspaceId: string
  threads: AgentThread[]
  thread: AgentThread | null
  messages: AgentMessage[]
  resources: AgentResource[]
  hasMore: boolean
  runs: AgentRun[]
  approvals: AgentApproval[]
}

export class AgentApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message)
    this.name = "AgentApiError"
  }
}

export async function agentApi<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch(`/api/focused-agent/${path}`, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    cache: "no-store",
    signal,
    headers:
      body === undefined
        ? {}
        : { "Content-Type": "application/json", "X-Focused-Agent-Action": "1" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok)
    throw new AgentApiError(
      payload?.error?.message || "The Agent request failed.",
      response.status,
      payload?.error?.code
    )
  return payload.data
}

/** Where a non-Pro Max user can upgrade. */
export const PROMAX_UPGRADE_URL =
  process.env.NEXT_PUBLIC_PROMAX_UPGRADE_URL || "https://scale.gg/pricing/"

/** Window events that keep the page and the docked panel on one thread. */
export const AGENT_THREAD_EVENT = "leadfinder-agent:thread"
export const AGENT_REFRESH_EVENT = "leadfinder-agent:refresh"
export const AGENT_OPEN_EVENT = "leadfinder-agent:open"

export const threadStorageKey = (access: Pick<AgentAccess, "userId" | "workspaceId">) =>
  `leadfinder-agent:${access.userId}:${access.workspaceId}`

export function openAgentDock() {
  window.dispatchEvent(new CustomEvent(AGENT_OPEN_EVENT))
}
