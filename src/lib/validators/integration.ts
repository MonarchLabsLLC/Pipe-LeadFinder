import { z } from "zod"

export const createIntegrationSchema = z.object({
  name: z.string().trim().min(1).max(100),
  url: z.string().trim().url().max(2_048),
  secret: z.string().min(16).max(512),
}).strict()

export const deliverIntegrationSchema = z.object({
  listId: z.string().min(1),
  entryIds: z.array(z.string().min(1)).min(1).max(100),
}).strict()
