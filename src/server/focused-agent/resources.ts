import { z } from "zod"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@/generated/prisma/client"
import { FocusedAgentError } from "./security"
import type { AgentActor } from "./access"

export const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
export const id = z.string().trim().min(1).max(200)
export const leadSelectionSchema = z
  .object({ listId: id, leadIds: z.array(id).min(1).max(50) })
  .strict()
export const listUrl = (id: string) =>
  `/lead-search/saved-lists/${encodeURIComponent(id)}`
export async function ownedList(a: AgentActor, id: string, active = false) {
  const list = await prisma.leadList.findFirst({
    where: { id, userId: a.userId },
  })
  if (!list)
    throw new FocusedAgentError(
      "LIST_NOT_FOUND",
      "This saved list is not available.",
      404
    )
  if (active && list.status !== "ACTIVE")
    throw new FocusedAgentError(
      "LIST_ARCHIVED",
      "Choose an active list before running an operation.",
      409
    )
  return list
}
export async function selectedLeads(
  a: AgentActor,
  listId: string,
  leadIds: string[],
  active = true
) {
  const list = await ownedList(a, listId, active)
  const entries = await prisma.leadListEntry.findMany({
    where: {
      listId,
      leadId: { in: [...new Set(leadIds)] },
      list: { userId: a.userId },
      lead: { userId: a.userId },
    },
    include: { lead: true },
    orderBy: { leadId: "asc" },
  })
  if (entries.length !== new Set(leadIds).size)
    throw new FocusedAgentError(
      "LEAD_NOT_FOUND",
      "One or more selected leads are not in this authorized list.",
      404
    )
  return { list, entries }
}
export async function listResources(a: AgentActor, query?: string, limit = 50) {
  const rows = await prisma.leadList.findMany({
    where: {
      userId: a.userId,
      ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: limit + 1,
  })
  return {
    resources: rows
      .slice(0, limit)
      .map((r) => ({
        id: r.id,
        name: r.name,
        status: r.status,
        type: r.type,
        version: r.updatedAt.toISOString(),
        url: listUrl(r.id),
      })),
    hasMore: rows.length > limit,
  }
}
export const leadView = (
  l: {
    id: string
    fullName: string | null
    firstName: string | null
    lastName: string | null
    email: string | null
    phone: string | null
    companyName: string | null
    title: string | null
    sourceType: string
    updatedAt: Date
    linkedinUrl: string | null
    companyWebsite: string | null
  },
  listId: string
) => ({
  id: l.id,
  name:
    l.fullName || [l.firstName, l.lastName].filter(Boolean).join(" ") || null,
  email: l.email,
  phone: l.phone,
  company: l.companyName,
  title: l.title,
  linkedinUrl: l.linkedinUrl,
  companyWebsite: l.companyWebsite,
  sourceType: l.sourceType,
  version: l.updatedAt.toISOString(),
  url: listUrl(listId),
})
export async function getList(
  a: AgentActor,
  input: { listId: string; cursor?: string; limit: number }
) {
  const list = await ownedList(a, input.listId)
  // A cursor is an owned entry ID, never an offset into another user's list.
  if (
    input.cursor &&
    !(await prisma.leadListEntry.findFirst({
      where: {
        id: input.cursor,
        listId: list.id,
        list: { userId: a.userId },
        lead: { userId: a.userId },
      },
    }))
  )
    throw new FocusedAgentError(
      "INVALID_CURSOR",
      "This list cursor is not available.",
      400
    )
  const rows = await prisma.leadListEntry.findMany({
    where: { listId: list.id, lead: { userId: a.userId } },
    orderBy: { id: "asc" },
    take: input.limit + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    include: { lead: true },
  })
  return {
    list: {
      id: list.id,
      name: list.name,
      type: list.type,
      status: list.status,
      url: listUrl(list.id),
    },
    leads: rows
      .slice(0, input.limit)
      .map((r) => ({ ...leadView(r.lead, list.id), entryId: r.id })),
    nextCursor: rows.length > input.limit ? rows[input.limit - 1].id : null,
  }
}
