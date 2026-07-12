import { z } from "zod"

export const bulkActionSchema = z.object({
  entryIds: z.array(z.string().min(1)).min(1).max(100),
  action: z.enum([
    "APPLY_LABEL",
    "REMOVE_LABEL",
    "COPY",
    "MOVE",
    "REMOVE",
    "ENRICH_EMAIL",
    "ENRICH_PHONE",
    "SCORE",
  ]),
  options: z.object({
    labelId: z.string().min(1).optional(),
    targetListId: z.string().min(1).optional(),
  }).strict().default({}),
}).strict()

export type BulkActionInput = z.infer<typeof bulkActionSchema>
