import { z } from "zod"
import { searchTypeEnum } from "@/lib/validators/list"

export const agentStatusSchema = z.enum(["DRAFT", "ACTIVE", "PAUSED"])
export const agentScheduleSchema = z.enum([
  "manual",
  "daily",
  "weekly",
  "monthly",
])
export const agentActionSchema = z.enum([
  "enrich_email",
  "enrich_phone",
  "ai_summary",
  "ai_direct_message",
])

const searchParamsSchema = z
  .record(z.string(), z.unknown())
  .refine((value) => JSON.stringify(value).length <= 20_000, {
    message: "Search parameters are too large",
  })

export const agentConfigSchema = z.object({
  searchType: searchTypeEnum.optional(),
  searchDescription: z.string().trim().max(2_000).optional(),
  searchLocation: z.string().trim().max(500).optional(),
  searchParams: searchParamsSchema.optional(),
  actions: z.array(agentActionSchema).max(4).default([]),
  connections: z.array(z.string().trim().url().max(2_048)).max(10).default([]),
  schedule: agentScheduleSchema.default("manual"),
  resultsLimit: z.number().int().min(1).max(100).optional(),
  listId: z.string().trim().min(1).max(200).optional(),
  leadCount: z.number().int().nonnegative().optional(),
  lastScheduledRunAt: z.string().datetime().nullable().optional(),
  nextScheduledRunAt: z.string().datetime().nullable().optional(),
  lastScheduledStatus: z.enum(["running", "completed", "failed"]).nullable().optional(),
  lastScheduledError: z.string().max(2_000).nullable().optional(),
  schedulerLockAt: z.string().datetime().nullable().optional(),
})

export const createAgentSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  description: z.string().trim().max(2_000).optional(),
  autoSave: z.boolean().optional(),
})

export const updateAgentSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(2_000).nullable().optional(),
    status: agentStatusSchema.optional(),
    config: agentConfigSchema.optional(),
    autoSave: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  })
