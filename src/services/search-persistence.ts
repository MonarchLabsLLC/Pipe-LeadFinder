import type { Prisma } from "@/generated/prisma/client"
import type { SearchType } from "@/generated/prisma/enums"
import { normalizeLeadIdentities } from "@/lib/lead-identity"
import { pickLeadFields } from "@/lib/pick-lead-fields"
import { prisma } from "@/lib/prisma"

export type DuplicatePolicy = "ONLY_NEW" | "ADD_EXISTING" | "RETURN_ALL"

function missingLeadFields(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>
) {
  const update: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(incoming)) {
    if (value == null || value === "") continue
    if (existing[key] == null || existing[key] === "") update[key] = value
  }
  if (typeof update.email === "string") update.emailStatus = "FOUND"
  if (typeof update.phone === "string") update.phoneStatus = "FOUND"
  return update
}

function isRetryableIdentityRace(error: unknown) {
  return error instanceof Error && "code" in error &&
    (error.code === "P2002" || error.code === "P2034")
}

export async function persistSearchResults({
  searchId,
  userId,
  listId,
  searchType,
  results,
  markCompleted = true,
  duplicatePolicy = "ONLY_NEW",
}: {
  searchId: string
  userId: string
  listId: string
  searchType: SearchType
  results: Array<Record<string, unknown>>
  markCompleted?: boolean
  duplicatePolicy?: DuplicatePolicy
}) {
  const persist = () => prisma.$transaction(async (tx) => {
    const leads = []

    for (const leadData of results) {
      const fields = pickLeadFields(leadData)
      if (typeof fields.email === "string") {
        fields.email = fields.email.trim().toLowerCase()
      }

      const identities = normalizeLeadIdentities(fields, searchType)
      const existingIdentity = identities.length
        ? await tx.leadIdentity.findFirst({
            where: {
              userId,
              OR: identities.map((identity) => ({
                type: identity.type,
                value: identity.value,
              })),
            },
            include: { lead: true },
          })
        : null

      if (existingIdentity) {
        const fill = missingLeadFields(
          existingIdentity.lead as unknown as Record<string, unknown>,
          fields
        )
        if (Object.keys(fill).length) {
          existingIdentity.lead = await tx.lead.update({
            where: { id: existingIdentity.leadId },
            data: fill as Prisma.LeadUncheckedUpdateInput,
          })
        }
        const existingIdentities = await tx.leadIdentity.findMany({
          where: {
            userId,
            OR: identities.map((identity) => ({ type: identity.type, value: identity.value })),
          },
          select: { type: true, value: true },
        })
        const claimed = new Set(existingIdentities.map((identity) => `${identity.type}:${identity.value}`))
        const newIdentities = identities.filter((identity) => !claimed.has(`${identity.type}:${identity.value}`))
        if (newIdentities.length) {
          await tx.leadIdentity.createMany({
            data: newIdentities.map((identity) => ({ ...identity, userId, leadId: existingIdentity.leadId })),
            skipDuplicates: true,
          })
        }
        const alreadyInList = await tx.leadListEntry.findUnique({
          where: {
            listId_leadId: { listId, leadId: existingIdentity.leadId },
          },
        })
        if (!alreadyInList && duplicatePolicy !== "ONLY_NEW") {
          await tx.leadListEntry.create({
            data: { listId, leadId: existingIdentity.leadId },
          })
        }
        if (duplicatePolicy === "RETURN_ALL") {
          leads.push(existingIdentity.lead)
        }
        continue
      }

      const lead = await tx.lead.create({
        data: {
          ...(fields as Prisma.LeadUncheckedCreateInput),
          userId,
          sourceType: searchType,
          emailStatus:
            typeof fields.email === "string" ? "FOUND" : "NOT_FOUND",
          identities: identities.length
            ? {
                create: identities.map((identity) => ({
                  userId,
                  type: identity.type,
                  value: identity.value,
                })),
              }
            : undefined,
        },
      })

      await tx.leadListEntry.create({ data: { listId, leadId: lead.id } })
      leads.push(lead)
    }

    if (markCompleted) {
      await tx.searchHistory.update({
        where: { id: searchId },
        data: { status: "COMPLETED", resultCount: leads.length },
      })
    }

    return leads
  }, { isolationLevel: "Serializable" })

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await persist()
    } catch (error) {
      if (!isRetryableIdentityRace(error) || attempt === 3) throw error
    }
  }
  throw new Error("Lead persistence retry limit reached")
}

export async function markSearchFailed(searchId: string) {
  try {
    await prisma.searchHistory.update({
      where: { id: searchId },
      data: { status: "FAILED" },
    })
  } catch (error) {
    console.error("Failed to mark search as failed", { searchId, error })
  }
}
