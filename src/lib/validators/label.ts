import { z } from "zod"

export const createLabelSchema = z.object({
  name: z.string().trim().min(1).max(50),
}).strict()

export type CreateLabelInput = z.infer<typeof createLabelSchema>
