import { z } from "zod"
import {
  peopleSearchSchema,
  localSearchSchema,
  companySearchSchema,
  domainSearchSchema,
  influencerSearchSchema,
} from "@/lib/validators/search"
import { validateSearchTarget } from "@/lib/search-target"
import { assertSearchConfigured } from "@/services/search-service"
import { getAiRuntimeConfig } from "@/services/ai-runtime"
import { getBusinessContext } from "@/services/ai-service"
import type { PipeLeadsCreditAction } from "@/lib/pipeleads-credit-pricing"
import { currentPrice } from "./pricing"
import {
  id,
  ownedList,
  selectedLeads,
  leadSelectionSchema,
  leadView,
  listUrl,
} from "./resources"
import { FocusedAgentError, hashCanonical } from "./security"
import type { AgentActor } from "./access"
import { buildExtraPlan, EXTRA_PLAN_ACTIONS, type ExtraPlanAction } from "./plans-extra"

export const searchSchemas = {
  PEOPLE: peopleSearchSchema,
  LOCAL: localSearchSchema,
  COMPANY: companySearchSchema,
  DOMAIN: domainSearchSchema,
  INFLUENCER: influencerSearchSchema,
}
export const prepareSearchSchema = z
  .object({
    type: z.enum(["PEOPLE", "LOCAL", "COMPANY", "DOMAIN", "INFLUENCER"]),
    parameters: z.record(z.string(), z.unknown()),
    /** Save results to a new list with this name (instead of parameters.listId). */
    newList: z
      .object({ name: z.string().trim().min(1).max(120) })
      .strict()
      .optional(),
  })
  .strict()
export const enrichSchema = leadSelectionSchema
  .extend({ field: z.enum(["email", "phone"]).default("email") })
  .strict()
/** Server-selected leads (every lead in a list missing the field), up to 500. */
export const bulkEnrichSchema = z
  .object({
    listId: id,
    leadIds: z.array(id).min(1).max(500),
    field: z.enum(["email", "phone"]),
  })
  .strict()
/** A placeholder that only exists while validating a new-list search. */
export const NEW_LIST_PLACEHOLDER = "__new_list__"
export type PlanAction =
  | "search"
  | "enrich"
  | "enrich_bulk"
  | "score"
  | ExtraPlanAction
export type Plan = {
  action: PlanAction
  input: Record<string, unknown>
  preview: Record<string, unknown>
  versions: Record<string, unknown>
}
export async function buildPlan(
  a: AgentActor,
  action: PlanAction,
  raw: unknown
): Promise<Plan> {
  if ((EXTRA_PLAN_ACTIONS as readonly string[]).includes(action))
    return buildExtraPlan(a, action as ExtraPlanAction, raw)
  if (action === "search") {
    const v = prepareSearchSchema.parse(raw)
    const newList = v.newList && !v.parameters.listId ? v.newList : undefined
    const parsed = searchSchemas[v.type].parse(
      newList ? { ...v.parameters, listId: NEW_LIST_PLACEHOLDER } : v.parameters
    )
    const { listId: parsedListId, duplicatePolicy, ...searchParams } = parsed
    const parameters = newList
      ? { ...searchParams, duplicatePolicy }
      : parsed
    let target: { id: string | null; name: string; url: string | null }
    let versions: Record<string, unknown>
    if (newList) {
      target = { id: null, name: newList.name, url: null }
      versions = { newList: { name: newList.name, type: v.type } }
    } else {
      const invalid = await validateSearchTarget(a.userId, parsedListId, v.type)
      if (invalid)
        throw new FocusedAgentError(
          "INVALID_LIST",
          (await invalid.json()).error,
          invalid.status
        )
      const list = await ownedList(a, parsedListId, true)
      target = { id: list.id, name: list.name, url: listUrl(list.id) }
      versions = {
        list: {
          id: list.id,
          updatedAt: list.updatedAt.toISOString(),
          type: list.type,
          status: list.status,
        },
      }
    }
    assertSearchConfigured(v.type, searchParams)
    const cost = await currentPrice(
      `search:${v.type.toLowerCase()}` as PipeLeadsCreditAction,
      parsed.resultsLimit
    )
    return {
      action,
      input: { type: v.type, parameters, ...(newList ? { newList } : {}) },
      versions,
      preview: {
        kind: "search",
        searchType: v.type,
        title: `Search for ${parsed.resultsLimit} ${v.type.toLowerCase()} results`,
        list: { ...target, isNew: Boolean(newList) },
        before: { parameters },
        after: { maximumResults: parsed.resultsLimit, listName: target.name },
        cost,
        effects: [
          newList
            ? `Creates the list "${newList.name}", starts one paid search and saves results there. Does not create a schedule or send messages.`
            : "Starts one paid search and saves results to this list. Does not create a schedule or send messages.",
          `Duplicate policy: ${duplicatePolicy}. Existing product matching may fill currently blank fields; it does not overwrite existing non-empty lead fields.`,
        ],
      },
    }
  }
  const v =
    action === "enrich"
      ? enrichSchema.parse(raw)
      : action === "enrich_bulk"
        ? bulkEnrichSchema.parse(raw)
        : leadSelectionSchema.parse(raw)
  const enriching = action === "enrich" || action === "enrich_bulk"
  const { list, entries } = await selectedLeads(a, v.listId, v.leadIds)
  const field: "email" | "phone" =
    "field" in v && v.field === "phone" ? "phone" : "email"
  const eligible =
    enriching
      ? entries.filter((e) =>
          field === "email"
            ? !e.lead.email
            : !e.lead.phone && Boolean(e.lead.linkedinUrl)
        )
      : entries
  const skipped = entries
    .filter((e) => !eligible.includes(e))
    .map((e) => ({
      id: e.leadId,
      name: leadView(e.lead, list.id).name,
      reason:
        field === "email"
          ? "Email already exists."
          : e.lead.phone
            ? "Phone already exists."
            : "LinkedIn profile required.",
    }))
  if (!eligible.length)
    throw new FocusedAgentError(
      "NO_ELIGIBLE_LEADS",
      "None of these leads needs the selected operation. Nothing was started.",
      409
    )
  const config = getAiRuntimeConfig("scoring")
  const cost =
    enriching
      ? await currentPrice(`enrich:${field}`, eligible.length)
      : {
          kind: "tokens",
          provider: config.provider,
          model: config.model,
          maximumLeads: eligible.length,
          maxOutputTokensPerBatch: 8000,
          note: "Scoring uses the existing AI model and actual input/output token billing. This is metered AI usage, not a fixed-price quote.",
        }
  return {
    action,
    input: {
      listId: list.id,
      leadIds: entries.map((e) => e.leadId),
      ...(enriching ? { field } : {}),
    },
    versions: {
      list: {
        id: list.id,
        updatedAt: list.updatedAt.toISOString(),
        type: list.type,
        status: list.status,
      },
      leads: entries.map((e) => ({
        id: e.leadId,
        version: e.lead.updatedAt.toISOString(),
      })),
      ...(action === "score"
        ? {
            businessContextHash: hashCanonical(
              await getBusinessContext(a.userId)
            ),
          }
        : {}),
    },
    preview: {
      kind: enriching ? "enrich" : "score",
      field: enriching ? field : undefined,
      title:
        enriching
          ? `Find ${field} details for ${eligible.length} leads`
          : `Score ${eligible.length} selected leads`,
      list: { id: list.id, name: list.name, url: listUrl(list.id) },
      // Bulk previews show the first 25; eligibleLeadIds stays exact.
      before: eligible
        .slice(0, action === "enrich_bulk" ? 25 : eligible.length)
        .map((e) => leadView(e.lead, list.id)),
      eligibleCount: eligible.length,
      after: {
        operation:
          enriching
            ? `Fill missing ${field}; results are not known until the approved provider job finishes.`
            : "Update saved AI lead scores using your current business context.",
      },
      eligibleLeadIds: eligible.map((e) => e.leadId),
      skipped,
      cost,
      effects: [
        "Runs once for these exact saved leads. No unattended schedules, CRM writes, or outbound messages.",
        ...(action === "score"
          ? [
              "Existing saved scoring results for these leads are replaced by the new scores.",
            ]
          : []),
      ],
    },
  }
}
