import { z } from "zod"

export const createLabelSchema = z.object({
  name: z.string().min(1),
})

export type CreateLabelInput = z.infer<typeof createLabelSchema>
