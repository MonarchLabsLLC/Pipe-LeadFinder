import { z } from "zod"

import { prepareSearchSchema, enrichSchema, type PlanAction } from "@/server/focused-agent/plans"
import { labelChangeSchema, scheduledAgentSchema } from "@/server/focused-agent/plans-extra"
import { id, leadSelectionSchema } from "@/server/focused-agent/resources"
import { bulkEnrichRequestSchema, rerunSchema } from "@/server/focused-agent/tools"

import { PLUGIN_APP, PLUGIN_APP_DISPLAY_NAME, PLUGIN_PROTOCOL_VERSION, type ActionLevel } from "./contract"

// What a Scale Plugin Store plugin may do in Lead Finder. This file is the
// source of docs/plugin-capabilities.json (GET /capabilities serves the same
// document); tests/plugins/plugin-capabilities.test.ts fails when they differ.
//
// Every action reuses a tool of the Lead Finder Agent (src/server/focused-agent):
// the same input schema, the same ownership checks and, for anything that
// changes data, the same priced plan and preview.
//
// Levels:
//   read   changes nothing
//   write  a free change that stays inside Lead Finder (labels)
//   act    spends the owner's Scale Credits, now or on a schedule. It waits for
//          the owner's approval unless they granted act_unattended for the area
//          AND set a monthly credit cap for the install (credits.ts). A plugin
//          job needs the whole maximum cost in the balance first: a plugin
//          never takes the balance below zero.
//
// interpret-request is free for plugins: Lead Finder pays its metered AI, and
// each install may call it INTERPRET_DAILY_LIMIT times per UTC day.
//
// Left out on purpose:
//   * every handoff (PipeLeads CRM, MailBaser): those reach into other apps
//   * ask_user and the Agent's own conversation tools

export type PluginAreaKey = "leads" | "searches" | "enrichment" | "credits" | "agents"

export const PLUGIN_AREAS: { key: PluginAreaKey; label: string; actLabel?: string }[] = [
  { key: "leads", label: "saved lists, leads and labels" },
  { key: "searches", label: "lead searches", actLabel: "Run lead searches that use your credits" },
  { key: "enrichment", label: "enrichment and scoring jobs", actLabel: "Enrich and score leads using your credits" },
  { key: "credits", label: "credit balance and prices" },
  { key: "agents", label: "scheduled lead agents", actLabel: "Schedule lead agents that use your credits" },
]

/** How an action runs. */
export type PluginActionRun =
  /** A read tool of the Agent's registry (src/server/focused-agent/actions.ts). */
  | { kind: "agent-read"; tool: "list_resources" | "get_list" | "list_labels" | "get_export_link" | "list_recent_searches" | "get_credits" }
  /** A background job the owner owns, of these kinds only. */
  | { kind: "job"; jobKinds: readonly string[] }
  | { kind: "list-agents" }
  /** The latest run of one AI Agent. */
  | { kind: "agent-run" }
  /** Plain words to search settings, free for plugins (no charge to the owner). */
  | { kind: "interpret" }
  /** A priced plan (plans.ts); `via` builds its input server-side first. */
  | { kind: "plan"; plan: PlanAction; via?: "rerun" | "bulk-enrich" }

export interface PluginAction {
  name: string
  title: string
  description: string
  area: PluginAreaKey
  level: ActionLevel
  schema: z.ZodType
  run: PluginActionRun
}

const runIdSchema = z.object({ runId: id }).strict()

/** interpret-request calls per install per UTC day (Lead Finder pays the AI). */
export const INTERPRET_DAILY_LIMIT = 200

const PLUGIN_CREDIT_RULE =
  "The owner's balance must cover the whole maximum cost first: a plugin never takes it below zero. Waits for the owner's approval unless the install holds act_unattended for this area and is inside the monthly credit cap the owner set for it."

export const PLUGIN_ACTIONS: PluginAction[] = [
  // ── leads ──────────────────────────────────────────────
  {
    name: "list-lists",
    title: "List saved lists",
    description: "Find the owner's saved lead lists by name. Starts no search and uses no credits.",
    area: "leads",
    level: "read",
    schema: z.object({ query: z.string().max(200).optional(), limit: z.number().int().min(1).max(50).optional() }).strict(),
    run: { kind: "agent-read", tool: "list_resources" },
  },
  {
    name: "get-list",
    title: "Read a saved list",
    description: "Read the leads saved in one list, 50 at a time. Pass nextCursor back as cursor for the next page.",
    area: "leads",
    level: "read",
    schema: z.object({ listId: id, cursor: id.optional(), limit: z.number().int().min(1).max(50).optional() }).strict(),
    run: { kind: "agent-read", tool: "get_list" },
  },
  {
    name: "list-labels",
    title: "List labels",
    description: "List the owner's custom labels.",
    area: "leads",
    level: "read",
    schema: z.object({}).strict(),
    run: { kind: "agent-read", tool: "list_labels" },
  },
  {
    name: "get-export-link",
    title: "Get a list's CSV link",
    description: "Get the CSV download link for a saved list. The link works in a browser signed in to Lead Finder. Uses no credits.",
    area: "leads",
    level: "read",
    schema: z.object({ listId: id }).strict(),
    run: { kind: "agent-read", tool: "get_export_link" },
  },
  {
    name: "change-labels",
    title: "Apply or remove a label",
    description: "Apply or remove one custom label on up to 50 saved leads in a list. Free, and nothing leaves Lead Finder.",
    area: "leads",
    level: "write",
    schema: labelChangeSchema,
    run: { kind: "plan", plan: "label" },
  },
  // ── searches ───────────────────────────────────────────
  {
    name: "interpret-request",
    title: "Turn a plain request into search settings",
    description: `Turn a plain request ("dentists in Austin with an email") into a search type and validated fields, and list which required details are still missing. Never runs a search. Free for plugins: it uses no Scale Credits of the owner's. Each install may call it ${INTERPRET_DAILY_LIMIT} times per UTC day.`,
    area: "searches",
    level: "read",
    schema: z.object({ text: z.string().trim().min(3).max(500) }).strict(),
    run: { kind: "interpret" },
  },
  {
    name: "list-recent-searches",
    title: "List recent searches",
    description: "List the owner's most recent searches: type, criteria, list and result count.",
    area: "searches",
    level: "read",
    schema: z.object({ limit: z.number().int().min(1).max(10).optional() }).strict(),
    run: { kind: "agent-read", tool: "list_recent_searches" },
  },
  {
    name: "get-search-run",
    title: "Read a search run",
    description: "Read the progress and result counts of a search this app is running or has finished.",
    area: "searches",
    level: "read",
    schema: runIdSchema,
    run: { kind: "job", jobKinds: ["SEARCH"] },
  },
  {
    name: "run-search",
    title: "Run a lead search",
    description:
      `Run one paid search (people, local, company, domain or influencer) and save the results to an existing list of the same type (parameters.listId) or to a new list (newList.name). Charges the owner's Scale Credits per result, up to parameters.resultsLimit. ${PLUGIN_CREDIT_RULE}`,
    area: "searches",
    level: "act",
    schema: prepareSearchSchema,
    run: { kind: "plan", plan: "search" },
  },
  {
    name: "rerun-search",
    title: "Run a recent search again",
    description: `Run one of the owner's recent searches again into the same list. Charges the owner's Scale Credits per result. ${PLUGIN_CREDIT_RULE}`,
    area: "searches",
    level: "act",
    schema: rerunSchema,
    run: { kind: "plan", plan: "search", via: "rerun" },
  },
  // ── enrichment ─────────────────────────────────────────
  {
    name: "get-enrichment-run",
    title: "Read an enrichment or scoring run",
    description: "Read the progress and counts of an enrichment or scoring job this app is running or has finished.",
    area: "enrichment",
    level: "read",
    schema: runIdSchema,
    run: { kind: "job", jobKinds: ["BULK_ENRICH_EMAIL", "BULK_ENRICH_PHONE", "BULK_SCORE"] },
  },
  {
    name: "enrich-leads",
    title: "Enrich selected leads",
    description: `Find the missing email or phone for up to 50 chosen leads in a list. Charges the owner's Scale Credits for each one found. ${PLUGIN_CREDIT_RULE}`,
    area: "enrichment",
    level: "act",
    schema: enrichSchema,
    run: { kind: "plan", plan: "enrich" },
  },
  {
    name: "enrich-list",
    title: "Enrich a whole list",
    description: `Find the missing email or phone for every lead in a list that lacks it, up to a limit of 500. Charges the owner's Scale Credits for each one found. ${PLUGIN_CREDIT_RULE}`,
    area: "enrichment",
    level: "act",
    schema: bulkEnrichRequestSchema,
    run: { kind: "plan", plan: "enrich_bulk", via: "bulk-enrich" },
  },
  {
    name: "score-leads",
    title: "Score selected leads",
    description: `Score up to 50 chosen leads against the owner's business profile. Uses metered AI, charged to the owner's Scale Credits. ${PLUGIN_CREDIT_RULE}`,
    area: "enrichment",
    level: "act",
    schema: leadSelectionSchema,
    run: { kind: "plan", plan: "score" },
  },
  // ── credits ────────────────────────────────────────────
  {
    name: "get-credits",
    title: "Read the credit balance",
    description:
      "Read the owner's Scale Credits balance and the current price per result. The balance can be negative: the app's own screens may start work at a zero balance. A plugin can start paid work only when the balance covers its whole maximum cost.",
    area: "credits",
    level: "read",
    schema: z.object({}).strict(),
    run: { kind: "agent-read", tool: "get_credits" },
  },
  // ── agents ─────────────────────────────────────────────
  {
    name: "list-agents",
    title: "List lead agents",
    description: "List the owner's AI Agents: name, status, schedule, search type and target list.",
    area: "agents",
    level: "read",
    schema: z.object({}).strict(),
    run: { kind: "list-agents" },
  },
  {
    name: "get-agent-run",
    title: "Read an agent's latest run",
    description: "Read the status, counts and list of one AI Agent's most recent run. Null when it has not run yet.",
    area: "agents",
    level: "read",
    schema: z.object({ agentId: id }).strict(),
    run: { kind: "agent-run" },
  },
  {
    name: "create-agent",
    title: "Schedule a lead agent",
    description:
      "Save a search as an AI Agent that runs daily, weekly or monthly. Every run charges the owner's Scale Credits without asking again, until the owner pauses or deletes it. Always waits for the owner's approval, even with act_unattended. Each run starts only when the balance covers the search's whole maximum cost: an agent a plugin scheduled never takes the balance below zero.",
    area: "agents",
    level: "act",
    schema: scheduledAgentSchema,
    run: { kind: "plan", plan: "agent" },
  },
]

export interface PluginEventDefinition {
  type: string
  area: PluginAreaKey
  description: string
}

/** Events with a real hook in the code (src/server/plugins/events.ts says where). */
export const PLUGIN_EVENTS: PluginEventDefinition[] = [
  { type: "leadfinder.search.completed", area: "searches", description: "A lead search finished and its results were saved to a list." },
  { type: "leadfinder.list.updated", area: "leads", description: "A saved list changed: leads were added, or labels were applied or removed." },
  { type: "leadfinder.enrichment.completed", area: "enrichment", description: "An enrichment or scoring job finished." },
  { type: "leadfinder.agent.run_completed", area: "agents", description: "An AI Agent finished a run (scheduled or started by hand) and saved its results to a list." },
]

const byName = new Map(PLUGIN_ACTIONS.map((action) => [action.name, action]))

export function pluginActionNamed(name: string): PluginAction | null {
  return byName.get(name) ?? null
}

function inputSchema(schema: z.ZodType): Record<string, unknown> {
  // "input": a field with a default is optional for the caller.
  const { $schema: _draft, ...rest } = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as Record<string, unknown>
  void _draft
  return rest
}

/** The capabilities contract (contract section 2). */
export function pluginCapabilities() {
  return {
    protocolVersion: PLUGIN_PROTOCOL_VERSION,
    app: PLUGIN_APP,
    displayName: PLUGIN_APP_DISPLAY_NAME,
    areas: PLUGIN_AREAS.map((area) => ({ key: area.key, label: area.label, ...(area.actLabel ? { actLabel: area.actLabel } : {}) })),
    actions: PLUGIN_ACTIONS.map((action) => ({
      name: action.name,
      title: action.title,
      description: action.description,
      area: action.area,
      level: action.level,
      inputSchema: inputSchema(action.schema),
    })),
    events: PLUGIN_EVENTS.map((event) => ({ type: event.type, area: event.area, description: event.description })),
  }
}
