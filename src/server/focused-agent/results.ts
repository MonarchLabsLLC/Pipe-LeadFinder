import { prisma } from "@/lib/prisma"
import { listUrl, leadView } from "./resources"

/**
 * What a finished search or enrichment left in the list, for the results card
 * in the conversation: counts, how many still lack an email or phone, and a
 * few example leads. Read-only and scoped to the list owner.
 */
export async function listResultSummary(
  userId: string,
  listId: string,
  searchId?: string | null
) {
  const list = await prisma.leadList.findFirst({
    where: { id: listId, userId },
    select: { id: true, name: true, type: true },
  })
  if (!list) return null
  const scope = { listId, list: { userId }, lead: { userId } }
  const [total, withEmail, withPhone, sample, search] = await Promise.all([
    prisma.leadListEntry.count({ where: scope }),
    prisma.leadListEntry.count({ where: { ...scope, lead: { userId, email: { not: null } } } }),
    prisma.leadListEntry.count({ where: { ...scope, lead: { userId, phone: { not: null } } } }),
    prisma.leadListEntry.findMany({
      where: scope,
      orderBy: { createdAt: "desc" },
      take: 3,
      include: { lead: true },
    }),
    searchId
      ? prisma.searchHistory.findFirst({
          where: { id: searchId, userId },
          select: { resultCount: true },
        })
      : null,
  ])
  return {
    list: { id: list.id, name: list.name, type: list.type, url: listUrl(list.id) },
    found: search?.resultCount ?? null,
    total,
    withEmail,
    withoutEmail: total - withEmail,
    withPhone,
    sample: sample.map((entry) => leadView(entry.lead, list.id)),
  }
}
