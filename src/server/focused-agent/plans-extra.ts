/**
 * Proposals that do not start a background job: applying or removing a label,
 * handing leads to PipeLeads CRM or MailBaser, and saving a search as a
 * scheduled AI Agent. Each one is prepared (and hashed) exactly like a search,
 * and runs only when a person approves the card; see executeExtraPlan().
 */
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { searchTypeEnum } from "@/lib/validators/list"
import { agentActionSchema } from "@/lib/validators/agent"
import { getNextScheduledRunAt } from "@/services/agent-runner"
import type { PipeLeadsCreditAction } from "@/lib/pipeleads-credit-pricing"
import type { Prisma } from "@/generated/prisma/client"
import { currentPrice } from "./pricing"
import { id, leadView, listUrl, ownedList, selectedLeads, json } from "./resources"
import { FocusedAgentError } from "./security"
import type { AgentActor } from "./access"
import {
  handoffTargetLabel,
  loadHandoffOptions,
  sendHandoffForActor,
  type HandoffTargetKey,
} from "./suite-handoff"

export const EXTRA_PLAN_ACTIONS = ["label", "handoff", "agent"] as const
export type ExtraPlanAction = (typeof EXTRA_PLAN_ACTIONS)[number]

type Plan = {
  action: ExtraPlanAction
  input: Record<string, unknown>
  preview: Record<string, unknown>
  versions: Record<string, unknown>
}

export const labelChangeSchema = z
  .object({
    listId: id,
    leadIds: z.array(id).min(1).max(50),
    labelId: id,
    operation: z.enum(["apply", "remove"]),
  })
  .strict()

export const suiteHandoffSchema = z
  .object({
    target: z.enum(["pipeleads", "mailbaser"]),
    listId: id,
    leadIds: z.array(id).min(1).max(50),
    // PipeLeads CRM
    createDeals: z.boolean().optional(),
    pipelineId: id.optional(),
    stageId: id.optional(),
    // MailBaser
    listIds: z.array(id).max(10).optional(),
    // Both
    tagNames: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  })
  .strict()

export const scheduledAgentSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    schedule: z.enum(["daily", "weekly", "monthly"]),
    type: searchTypeEnum,
    /** Search criteria, same fields as prepare_search (no listId). */
    parameters: z.record(z.string(), z.unknown()),
    listId: id.optional(),
    actions: z.array(agentActionSchema).max(4).default([]),
  })
  .strict()

const listVersion = (list: {
  id: string
  updatedAt: Date
  type: string
  status: string
}) => ({
  id: list.id,
  updatedAt: list.updatedAt.toISOString(),
  type: list.type,
  status: list.status,
})

async function labelPlan(a: AgentActor, raw: unknown): Promise<Plan> {
  const v = labelChangeSchema.parse(raw)
  const { list, entries } = await selectedLeads(a, v.listId, v.leadIds)
  const label = await prisma.customLabel.findFirst({
    where: { id: v.labelId, userId: a.userId },
  })
  if (!label)
    throw new FocusedAgentError("LABEL_NOT_FOUND", "This label is not available.", 404)
  const applied = new Set(
    (
      await prisma.leadEntryLabel.findMany({
        where: { labelId: label.id, entryId: { in: entries.map((e) => e.id) } },
        select: { entryId: true },
      })
    ).map((row) => row.entryId)
  )
  const eligible = entries.filter((e) =>
    v.operation === "apply" ? !applied.has(e.id) : applied.has(e.id)
  )
  if (!eligible.length)
    throw new FocusedAgentError(
      "NO_ELIGIBLE_LEADS",
      v.operation === "apply"
        ? "These leads already have this label. Nothing was changed."
        : "None of these leads has this label. Nothing was changed.",
      409
    )
  const verb = v.operation === "apply" ? "Apply" : "Remove"
  return {
    action: "label",
    input: { ...v, leadIds: entries.map((e) => e.leadId) },
    versions: {
      list: listVersion(list),
      label: { id: label.id, name: label.name },
      applied: [...applied].sort(),
    },
    preview: {
      kind: "label",
      title: `${verb} “${label.name}” ${v.operation === "apply" ? "on" : "from"} ${eligible.length} leads`,
      list: { id: list.id, name: list.name, url: listUrl(list.id) },
      label: { id: label.id, name: label.name },
      before: eligible.map((e) => leadView(e.lead, list.id)),
      eligibleEntryIds: eligible.map((e) => e.id),
      eligibleCount: eligible.length,
      skipped: entries
        .filter((e) => !eligible.includes(e))
        .map((e) => ({
          id: e.leadId,
          name: leadView(e.lead, list.id).name,
          reason: v.operation === "apply" ? "Already labelled." : "Not labelled.",
        })),
      cost: { maximumCredits: 0, note: "Labels are free." },
      effects: [
        `${verb}s one label on these exact saved leads. No credits, no messages.`,
      ],
    },
  }
}

async function handoffPlan(a: AgentActor, raw: unknown): Promise<Plan> {
  const v = suiteHandoffSchema.parse(raw)
  const target = v.target as HandoffTargetKey
  const { list, entries } = await selectedLeads(a, v.listId, v.leadIds)
  const options = await loadHandoffOptions(a, target)
  let destination: Record<string, unknown>
  if (target === "pipeleads") {
    const createDeals = v.createDeals === true
    const pipeline = createDeals
      ? options.pipelines?.find((p) => p.id === v.pipelineId)
      : undefined
    const stage = pipeline?.stages.find((s) => s.id === v.stageId)
    if (createDeals && (!pipeline || !stage))
      throw new FocusedAgentError(
        "INVALID_DESTINATION",
        "Choose a pipeline and stage from get_handoff_options before creating deals.",
        400
      )
    destination = {
      createDeals,
      pipeline: pipeline ? { id: pipeline.id, name: pipeline.name } : null,
      stage: stage ? { id: stage.id, name: stage.name } : null,
    }
  } else {
    const lists = (v.listIds ?? []).map((listId) => {
      const found = options.lists?.find((l) => l.id === listId)
      if (!found)
        throw new FocusedAgentError(
          "INVALID_DESTINATION",
          "Choose MailBaser lists from get_handoff_options.",
          400
        )
      return { id: found.id, name: found.name }
    })
    destination = { workspaceName: options.workspaceName ?? null, lists }
  }
  const withoutEmail = entries.filter((e) => !e.lead.email).length
  const label = handoffTargetLabel(target)
  return {
    action: "handoff",
    input: { ...v, leadIds: entries.map((e) => e.leadId) },
    versions: {
      list: listVersion(list),
      leads: entries.map((e) => ({ id: e.leadId, version: e.lead.updatedAt.toISOString() })),
      destination,
    },
    preview: {
      kind: "handoff",
      target,
      title:
        target === "pipeleads"
          ? `Send ${entries.length} leads to PipeLeads CRM`
          : `Add ${entries.length} leads to MailBaser`,
      list: { id: list.id, name: list.name, url: listUrl(list.id) },
      destination: { ...destination, tagNames: v.tagNames ?? [] },
      before: entries.map((e) => leadView(e.lead, list.id)),
      eligibleCount: entries.length,
      skipped: [],
      cost: { maximumCredits: 0, note: `Sending to ${label} does not use credits.` },
      effects: [
        target === "pipeleads"
          ? "Creates or updates contacts in PipeLeads CRM (existing contacts are matched, never overwritten with blanks)."
          : "Adds or updates contacts in MailBaser. Leads without an email are skipped.",
        ...(target === "mailbaser" && withoutEmail
          ? [`${withoutEmail} of these leads have no email and will be skipped.`]
          : []),
        "Sends no email by itself.",
      ],
    },
  }
}

/** Map agent-config fields the same way the AI Agents page does. */
function agentConfigFor(v: z.infer<typeof scheduledAgentSchema>) {
  const p = { ...v.parameters }
  const take = (key: string) => {
    const value = p[key]
    delete p[key]
    return typeof value === "string" && value.trim() ? value.trim() : undefined
  }
  let searchDescription: string | undefined
  let searchLocation: string | undefined
  if (v.type === "LOCAL") {
    searchDescription = take("businessType")
    searchLocation = take("location")
  } else if (v.type === "DOMAIN") {
    searchDescription = take("companyNameOrWebsite")
  } else {
    searchDescription = take("description")
    searchLocation = take("location")
  }
  const resultsLimit =
    typeof p.resultsLimit === "number" ? Math.min(100, Math.max(1, Math.round(p.resultsLimit))) : 10
  delete p.resultsLimit
  delete p.listId
  delete p.duplicatePolicy
  return {
    searchType: v.type,
    ...(searchDescription ? { searchDescription } : {}),
    ...(searchLocation ? { searchLocation } : {}),
    searchParams: p,
    resultsLimit,
    actions: v.actions,
    connections: [],
    schedule: v.schedule,
    ...(v.listId ? { listId: v.listId } : {}),
  }
}

async function agentPlan(a: AgentActor, raw: unknown): Promise<Plan> {
  const v = scheduledAgentSchema.parse(raw)
  if (!searchNeedsText(v)) {
    throw new FocusedAgentError(
      "INVALID_INPUT",
      "Describe what the agent should search for first.",
      400
    )
  }
  const list = v.listId ? await ownedList(a, v.listId, true) : null
  if (list && list.type !== v.type)
    throw new FocusedAgentError(
      "INVALID_LIST",
      `This agent needs a ${v.type.toLowerCase()} list.`,
      409
    )
  const config = agentConfigFor(v)
  const perRun = await currentPrice(
    `search:${v.type.toLowerCase()}` as PipeLeadsCreditAction,
    config.resultsLimit
  )
  return {
    action: "agent",
    input: v,
    versions: { list: list ? listVersion(list) : null },
    preview: {
      kind: "agent",
      title: `Save “${v.name}” as a ${v.schedule} AI Agent`,
      list: list
        ? { id: list.id, name: list.name, url: listUrl(list.id) }
        : { id: null, name: "A new list on the first run", url: null },
      schedule: v.schedule,
      before: { config },
      cost: {
        ...perRun,
        note: `Each ${v.schedule} run can charge up to ${perRun.maximumCredits} Scale Credits for the search, plus any enrichment it does. Pause it any time in AI Agents.`,
      },
      effects: [
        `Creates an active AI Agent that runs ${v.schedule}; the first run is one ${v.schedule === "daily" ? "day" : v.schedule === "weekly" ? "week" : "month"} after you approve.`,
        "Each run spends credits without asking again until you pause or delete the agent.",
      ],
    },
  }
}

function searchNeedsText(v: z.infer<typeof scheduledAgentSchema>) {
  const p = v.parameters
  const text = (key: string) => typeof p[key] === "string" && String(p[key]).trim()
  if (v.type === "LOCAL") return Boolean(text("businessType") && text("location"))
  if (v.type === "DOMAIN") return Boolean(text("companyNameOrWebsite"))
  if (v.type === "COMPANY")
    return ["description", "industry", "companyName", "domain", "technologies", "keyword"].some(text)
  return Boolean(text("description"))
}

export async function buildExtraPlan(
  a: AgentActor,
  action: ExtraPlanAction,
  raw: unknown
): Promise<Plan> {
  if (action === "label") return labelPlan(a, raw)
  if (action === "handoff") return handoffPlan(a, raw)
  return agentPlan(a, raw)
}

/** Runs an approved, freshly re-validated plan. Returns the recorded result. */
export async function executeExtraPlan(
  a: AgentActor,
  fresh: Plan,
  proposalId: string
): Promise<Record<string, unknown>> {
  if (fresh.action === "label") {
    const v = labelChangeSchema.parse(fresh.input)
    const entryIds = fresh.preview.eligibleEntryIds as string[]
    // Scope again at write time: only entries in the actor's own list.
    const owned = await prisma.leadListEntry.findMany({
      where: { id: { in: entryIds }, listId: v.listId, list: { userId: a.userId } },
      select: { id: true },
    })
    const ids = owned.map((row) => row.id)
    const changed =
      v.operation === "apply"
        ? (
            await prisma.leadEntryLabel.createMany({
              data: ids.map((entryId) => ({ entryId, labelId: v.labelId })),
              skipDuplicates: true,
            })
          ).count
        : (
            await prisma.leadEntryLabel.deleteMany({
              where: { labelId: v.labelId, entryId: { in: ids } },
            })
          ).count
    return { changed, listId: v.listId, url: listUrl(v.listId) }
  }
  if (fresh.action === "handoff") {
    const v = suiteHandoffSchema.parse(fresh.input)
    const sent = await sendHandoffForActor(a, v.target, {
      leadIds: v.leadIds,
      ...(v.target === "pipeleads"
        ? {
            createDeals: v.createDeals === true,
            ...(v.createDeals ? { pipelineId: v.pipelineId, stageId: v.stageId } : {}),
          }
        : { ...(v.listIds?.length ? { listIds: v.listIds } : {}) }),
      ...(v.tagNames?.length ? { tagNames: v.tagNames } : {}),
    })
    return { ...sent, listId: v.listId, url: listUrl(v.listId) }
  }
  const v = scheduledAgentSchema.parse(fresh.input)
  const config = {
    ...agentConfigFor(v),
    nextScheduledRunAt: getNextScheduledRunAt(v.schedule),
  }
  const agent = await prisma.aiAgent.create({
    data: {
      userId: a.userId,
      name: v.name,
      description: `Saved from the Lead Finder agent (approval ${proposalId.slice(0, 8)}).`,
      status: "ACTIVE",
      config: json(config) as Prisma.InputJsonValue,
    },
  })
  return { agentId: agent.id, url: "/ai/ai-agent" }
}
