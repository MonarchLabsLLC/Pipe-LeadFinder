import { z } from "zod"

export const createPromptSchema = z.object({
  name: z.string().min(1, "Name is required"),
  prompt: z.string().min(1, "Prompt is required"),
})

export const updatePromptSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  prompt: z.string().min(1, "Prompt is required").optional(),
})

export type CreatePromptInput = z.infer<typeof createPromptSchema>
export type UpdatePromptInput = z.infer<typeof updatePromptSchema>
