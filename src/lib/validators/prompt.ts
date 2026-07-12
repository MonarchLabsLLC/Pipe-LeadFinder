import { z } from "zod"

export const createPromptSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  prompt: z.string().trim().min(1, "Prompt is required").max(20_000),
}).strict()

export const updatePromptSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200).optional(),
  prompt: z.string().trim().min(1, "Prompt is required").max(20_000).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: "At least one field is required",
})

export type CreatePromptInput = z.infer<typeof createPromptSchema>
export type UpdatePromptInput = z.infer<typeof updatePromptSchema>
