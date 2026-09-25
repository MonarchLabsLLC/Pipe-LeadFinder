import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { publicJobRun } from "@/lib/jobs/service"
import { listResources, getList, id, leadSelectionSchema, ownedList, listUrl, absoluteUrl } from "./resources"
import { prepareSearchSchema, enrichSchema } from "./plans"
import { prepareProposal } from "./proposals"
import { FocusedAgentError } from "./security"
import type { AgentActor } from "./access"
import { recoverApprovedJob } from "./job-recovery"
import { crmDestinations, prepareCrmTransfer, crmTransferStatus, handoffDestinationSchema, handoffPrepareSchema } from "./handoff"
import { labelChangeSchema, suiteHandoffSchema, scheduledAgentSchema } from "./plans-extra"
import { loadHandoffOptions } from "./suite-handoff"
import { askUserSchema, bulkEnrichRequestSchema, interpretRequest, rerunSchema, recentSearches, creditsOverview, bulkEnrichSelection, rerunSearchInput } from "./tools"

/**
 * The Agent's tool registry. Two tiers only:
 * - read: runs immediately and changes nothing;
 * - prepare: creates a hashed, expiring proposal card. Nothing happens until a
 *   person presses Approve (proposals.ts decideProposal). There is no execute
 *   tool: the model can never run a paid or data-changing operation itself.
 */
export type ToolTier = "read" | "prepare"
type ActionDefinition = { description: string; schema: z.ZodType; tier: ToolTier }

export const actions = {
  ask_user: {
    tier: "read",
    description:
      "Ask the user ONE short multiple-choice question when a required detail is missing (for example the city, company size, how many results, or email vs phone). Give 2-4 short options; the user can also type something else. The turn ends after this call and the user's answer arrives as the next message.",
    schema: askUserSchema,
  },
  interpret_request: {
    tier: "read",
    description:
      "Turn the user's own words into a search type and validated fields, and list which required details are still missing. Uses a small amount of metered AI; never runs a search.",
    schema: z.object({ text: z.string().trim().min(3).max(500) }).strict(),
  },
  get_credits: {
    tier: "read",
    description: "Read the user's Scale Credits balance and the current per-result prices.",
    schema: z.object({}).strict(),
  },
  list_recent_searches: {
    tier: "read",
    description: "List the user's most recent searches (type, criteria, list, result count) so one can be run again.",
    schema: z.object({ limit: z.number().int().min(1).max(10).optional() }).strict(),
  },
  list_labels: {
    tier: "read",
    description: "List the user's custom labels.",
    schema: z.object({}).strict(),
  },
  get_export_link: {
    tier: "read",
    description: "Get the CSV download link for an owned saved list.",
    schema: z.object({ listId: id }).strict(),
  },
  get_handoff_options: {
    tier: "read",
    description:
      "Read where leads can be sent: PipeLeads CRM pipelines and stages, or MailBaser lists and tags. Ask the user which one before preparing a handoff.",
    schema: z.object({ target: z.enum(["pipeleads", "mailbaser"]) }).strict(),
  },
  get_crm_destinations: { tier: "read", description: "List authorized CRM workspaces, pipelines and stages for a lead handoff. Ask which destination the user wants.", schema: handoffDestinationSchema },
  get_crm_transfer_status: { tier: "read", description: "Read an owned CRM transfer's approval state, background progress, failures and completed record links. Never automatically repeat uncertain rows.", schema: z.object({ proposalId: z.string().uuid() }).strict() },
  prepare_crm_transfer: { tier: "prepare", description: "Prepare an exact CRM-owned preview for selected saved leads. Skip existing matches, flag incomplete records, never overwrite. Return the CRM approval link; only a human can approve there. Nothing is transferred by this tool.", schema: handoffPrepareSchema },
  list_resources: {
    tier: "read",
    description:
      "Find your existing saved prospect lists. No paid search is started.",
    schema: z
      .object({
        query: z.string().max(200).optional(),
        limit: z.number().int().min(1).max(50).optional(),
      })
      .strict(),
  },
  get_list: {
    tier: "read",
    description: "Read actual saved leads in an owned list, with pagination.",
    schema: z
      .object({
        listId: id,
        cursor: id.optional(),
        limit: z.number().int().min(1).max(50).optional(),
      })
      .strict(),
  },
  prepare_search: {
    tier: "prepare",
    description:
      "Prepare one paid search as an approval card (type, criteria, estimated credits, target list). Save to an existing list of the same type (listId) or to a new list (newListName). Interview for missing criteria first. No work starts until the human approves.",
    schema: prepareSearchSchema,
  },
  prepare_rerun_search: {
    tier: "prepare",
    description: "Prepare running one of the user's recent searches again into the same list. Requires approval.",
    schema: rerunSchema,
  },
  prepare_enrichment: {
    tier: "prepare",
    description:
      "Preview the exact selected leads, skipped records and maximum cost to find missing email or phone details. Requires human approval.",
    schema: enrichSchema,
  },
  prepare_bulk_enrichment: {
    tier: "prepare",
    description:
      "Prepare finding the missing email (or phone) for every lead in a list that lacks it, up to a limit. Use for requests like 'enrich the ones without email'. Requires approval.",
    schema: bulkEnrichRequestSchema,
  },
  prepare_scoring: {
    tier: "prepare",
    description:
      "Preview scoring for exact selected leads. Uses existing business context and token-metered AI. Requires human approval.",
    schema: leadSelectionSchema,
  },
  prepare_label_change: {
    tier: "prepare",
    description: "Prepare applying or removing one custom label on selected saved leads (max 50). Requires approval.",
    schema: labelChangeSchema,
  },
  prepare_handoff: {
    tier: "prepare",
    description:
      "Prepare sending selected saved leads (max 50) to PipeLeads CRM (optionally creating deals in a pipeline stage) or adding them to MailBaser lists. Use ids from get_handoff_options. Requires approval.",
    schema: suiteHandoffSchema,
  },
  prepare_scheduled_agent: {
    tier: "prepare",
    description:
      "Prepare saving a search as an AI Agent that runs daily, weekly or monthly and spends credits on each run. Requires approval.",
    schema: scheduledAgentSchema,
  },
  get_run: {
    tier: "read",
    description:
      "Read progress/results of an approved background job owned by this user.",
    schema: z.object({ runId: id }).strict(),
  },
} satisfies Record<string, ActionDefinition>

export type ActionName = keyof typeof actions

/**
 * The actions the signed ClickCampaigns Superpowers (MCP) service exposes:
 * every registry tool except ask_user (the MCP host asks the user itself).
 * The same schemas, ownership checks and proposal/approval path apply;
 * prepare_* only creates a proposal, and only a signed human approval grant
 * on proposals/:id/execute runs it.
 */
export const SERVICE_ACTIONS = [
  "get_crm_destinations",
  "get_crm_transfer_status",
  "prepare_crm_transfer",
  "list_resources",
  "get_list",
  "prepare_search",
  "prepare_enrichment",
  "prepare_scoring",
  "get_run",
  "interpret_request",
  "get_credits",
  "list_recent_searches",
  "list_labels",
  "get_export_link",
  "get_handoff_options",
  "prepare_rerun_search",
  "prepare_bulk_enrichment",
  "prepare_label_change",
  "prepare_handoff",
  "prepare_scheduled_agent",
] as const satisfies readonly ActionName[]

export async function getApprovedJob(a: AgentActor, jobId: string) {
  let job = await prisma.jobRun.findFirst({
    where: { id: jobId, userId: a.userId },
  })
  const proposalId = (
    job?.payload as { focusedAgentApprovalId?: string } | null
  )?.focusedAgentApprovalId
  const approval = proposalId
    ? await prisma.focusedAgentApproval.findFirst({
        where: { id: proposalId, userId: a.userId, workspaceId: a.workspaceId },
      })
    : null
  if (!job || !approval)
    throw new FocusedAgentError(
      "RUN_NOT_FOUND",
      "This approved job is not available.",
      404
    )
  job = await recoverApprovedJob(job)
  return {
    ...publicJobRun(job),
    runId: job.id,
    status: job.status.toLowerCase(),
    url: job.listId
      ? `/lead-search/saved-lists/${encodeURIComponent(job.listId)}`
      : null,
  }
}

function listIdOf(name: string, input: Record<string, unknown>) {
  if (typeof input.listId === "string") return input.listId
  if (name === "prepare_search")
    return (input as z.infer<typeof prepareSearchSchema>).parameters.listId as
      | string
      | undefined
  return undefined
}

export async function dispatch(
  a: AgentActor,
  name: string,
  raw: unknown,
  context: {
    key: string
    threadId?: string
    allowedIds?: string[]
    leadIds?: string[]
  }
) {
  if (!Object.hasOwn(actions, name))
    throw new FocusedAgentError(
      "UNSUPPORTED_ACTION",
      "This Agent action is not supported.",
      400
    )
  const input = actions[name as ActionName].schema.parse(raw) as Record<string, unknown>
  const listId = listIdOf(name, input)
  // When the user has selected a list, the Agent stays inside it. Without a
  // selection it may use any list the user owns (ownership is checked by
  // every tool) and the approval card always names the target list.
  if (
    listId &&
    context.allowedIds?.length &&
    !context.allowedIds.includes(String(listId))
  )
    throw new FocusedAgentError(
      "RESOURCE_SELECTION_REQUIRED",
      "Select that saved list before asking me to use it.",
      409
    )
  if (
    Array.isArray(input.leadIds) &&
    context.leadIds?.length &&
    (input.leadIds as string[]).some((leadId) => !context.leadIds!.includes(leadId))
  )
    throw new FocusedAgentError(
      "SELECTION_MISMATCH",
      "This request includes leads outside your visible selection.",
      409
    )
  switch (name as ActionName) {
    case "ask_user":
      // Rendered as tap-to-answer choices by the runtime; nothing to run.
      return { asked: true, question: input }
    case "interpret_request":
      return interpretRequest(a, String(input.text), context.key)
    case "get_credits":
      return creditsOverview(a)
    case "list_recent_searches":
      return recentSearches(a, (input.limit as number | undefined) ?? 6)
    case "list_labels":
      return {
        labels: await prisma.customLabel.findMany({
          where: { userId: a.userId },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
          take: 100,
        }),
      }
    case "get_export_link": {
      const list = await ownedList(a, String(input.listId))
      const path = `/api/lists/${encodeURIComponent(list.id)}/export`
      // MCP clients run outside the app, so they need the public origin.
      const mcp = a.origin === "mcp"
      return {
        list: { id: list.id, name: list.name, url: mcp ? absoluteUrl(listUrl(list.id)) : listUrl(list.id) },
        downloadUrl: mcp ? absoluteUrl(path) : path,
        note: mcp
          ? "Opening the link in a browser signed in to Lead Finder downloads a CSV of every lead in the list. It does not use credits."
          : "Opening the link downloads a CSV of every lead in the list. It does not use credits.",
      }
    }
    case "get_handoff_options":
      return loadHandoffOptions(a, input.target as "pipeleads" | "mailbaser")
    case "list_resources":
      return listResources(a, input.query as string | undefined, input.limit as number | undefined)
    case "get_list":
      return getList(a, {
        listId: String(input.listId),
        cursor: input.cursor as string | undefined,
        limit: (input.limit as number | undefined) ?? 50,
      })
    case "get_run":
      return getApprovedJob(a, String(input.runId))
    case "get_crm_destinations":
      return crmDestinations(a, input, context.key)
    case "get_crm_transfer_status":
      return crmTransferStatus(a, String(input.proposalId), context.key)
    case "prepare_crm_transfer":
      return prepareCrmTransfer(a, input, context.key)
    case "prepare_rerun_search":
      return prepareProposal(a, "search", await rerunSearchInput(a, input), context.key, context.threadId)
    case "prepare_bulk_enrichment":
      return prepareProposal(a, "enrich_bulk", await bulkEnrichSelection(a, input), context.key, context.threadId)
    case "prepare_label_change":
      return prepareProposal(a, "label", input, context.key, context.threadId)
    case "prepare_handoff":
      return prepareProposal(a, "handoff", input, context.key, context.threadId)
    case "prepare_scheduled_agent":
      return prepareProposal(a, "agent", input, context.key, context.threadId)
    case "prepare_search":
      return prepareProposal(a, "search", input, context.key, context.threadId)
    case "prepare_enrichment":
      return prepareProposal(a, "enrich", input, context.key, context.threadId)
    case "prepare_scoring":
      return prepareProposal(a, "score", input, context.key, context.threadId)
  }
}
