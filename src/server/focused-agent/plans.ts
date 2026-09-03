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
  ownedList,
  selectedLeads,
  leadSelectionSchema,
  leadView,
  listUrl,
} from "./resources"
import { FocusedAgentError, hashCanonical } from "./security"
import type { AgentActor } from "./access"

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
  })
  .strict()
export const enrichSchema = leadSelectionSchema
  .extend({ field: z.enum(["email", "phone"]).default("email") })
  .strict()
export type PlanAction = "search" | "enrich" | "score"
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
  if (action === "search") {
    const v = prepareSearchSchema.parse(raw)
    const parameters = searchSchemas[v.type].parse(v.parameters)
    const { listId, duplicatePolicy, ...searchParams } = parameters
    const invalid = await validateSearchTarget(a.userId, listId, v.type)
    if (invalid)
      throw new FocusedAgentError(
        "INVALID_LIST",
        (await invalid.json()).error,
        invalid.status
      )
    const list = await ownedList(a, listId, true)
    assertSearchConfigured(v.type, searchParams)
    const cost = await currentPrice(
      `search:${v.type.toLowerCase()}` as PipeLeadsCreditAction,
      parameters.resultsLimit
    )
    return {
      action,
      input: { type: v.type, parameters },
      versions: {
        list: {
          id: list.id,
          updatedAt: list.updatedAt.toISOString(),
          type: list.type,
          status: list.status,
        },
      },
      preview: {
        title: `Search for ${parameters.resultsLimit} ${v.type.toLowerCase()} results`,
        list: { id: list.id, name: list.name, url: listUrl(list.id) },
        before: { parameters },
        after: { maximumResults: parameters.resultsLimit, listName: list.name },
        cost,
        effects: [
          "Starts one paid search and saves results to this list. Does not create a schedule or send messages.",
          `Duplicate policy: ${duplicatePolicy}. Existing product matching may fill currently blank fields; it does not overwrite existing non-empty lead fields.`,
        ],
      },
    }
  }
  const v =
    action === "enrich"
      ? enrichSchema.parse(raw)
      : leadSelectionSchema.parse(raw)
  const { list, entries } = await selectedLeads(a, v.listId, v.leadIds)
  const field: "email" | "phone" =
    "field" in v && v.field === "phone" ? "phone" : "email"
  const eligible =
    action === "enrich"
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
    action === "enrich"
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
      ...(action === "enrich" ? { field } : {}),
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
      title:
        action === "enrich"
          ? `Find ${field} details for ${eligible.length} leads`
          : `Score ${eligible.length} selected leads`,
      list: { id: list.id, name: list.name, url: listUrl(list.id) },
      before: eligible.map((e) => leadView(e.lead, list.id)),
      after: {
        operation:
          action === "enrich"
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
