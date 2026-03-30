import { z } from "zod"

const searchTypeEnum = z.enum(["PEOPLE", "LOCAL", "COMPANY", "DOMAIN", "INFLUENCER"])
const listStatusEnum = z.enum(["ACTIVE", "ARCHIVED"])

export const createListSchema = z.object({
  name: z.string().min(1),
  type: searchTypeEnum,
})

export type CreateListInput = z.infer<typeof createListSchema>

export const updateListSchema = z.object({
  name: z.string().min(1).optional(),
  status: listStatusEnum.optional(),
})

export type UpdateListInput = z.infer<typeof updateListSchema>
