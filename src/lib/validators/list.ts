import { z } from "zod"

export const searchTypeEnum = z.enum([
  "PEOPLE",
  "LOCAL",
  "COMPANY",
  "DOMAIN",
  "INFLUENCER",
])
export const listStatusEnum = z.enum(["ACTIVE", "ARCHIVED"])

export const listQuerySchema = z.object({
  type: searchTypeEnum.optional(),
  status: listStatusEnum.default("ACTIVE"),
})

export const createListSchema = z.object({
  name: z.string().trim().min(1).max(100),
  type: searchTypeEnum,
}).strict()

export type CreateListInput = z.infer<typeof createListSchema>

export const updateListSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  status: listStatusEnum.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: "At least one field is required",
})

export type UpdateListInput = z.infer<typeof updateListSchema>
