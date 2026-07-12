import type { SearchType } from "@/generated/prisma/enums"
import { pickLeadFields } from "@/lib/pick-lead-fields"
import { prisma } from "@/lib/prisma"
import type { LeadWhereInput } from "@/generated/prisma/models/Lead"

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function insensitive(value: string) {
  return { equals: value, mode: "insensitive" as const }
}

function identityFilters(
  fields: Record<string, unknown>,
  searchType: SearchType
): LeadWhereInput[] {
  const filters: LeadWhereInput[] = []
  const email = text(fields.email)
  const linkedinUrl = text(fields.linkedinUrl)
  const platform = text(fields.platform)
  const username = text(fields.username)
  const companyWebsite = text(fields.companyWebsite)
  const companyName = text(fields.companyName)
  const location = text(fields.location)
  const fullName = text(fields.fullName)

  if (email) filters.push({ email: insensitive(email) })
  if (linkedinUrl) filters.push({ linkedinUrl: insensitive(linkedinUrl) })
  if (platform && username) {
    filters.push({
      platform: insensitive(platform),
      username: insensitive(username),
    })
  }

  if (searchType === "COMPANY" && companyWebsite) {
    filters.push({ companyWebsite: insensitive(companyWebsite) })
  }
  if ((searchType === "LOCAL" || searchType === "COMPANY") && companyName) {
    filters.push({
      companyName: insensitive(companyName),
      ...(location ? { location: insensitive(location) } : {}),
    })
  }
  if ((searchType === "PEOPLE" || searchType === "DOMAIN") && fullName && companyName) {
    filters.push({
      fullName: insensitive(fullName),
      companyName: insensitive(companyName),
    })
  }

  return filters
}

export async function persistSearchResults({
  searchId,
  listId,
  searchType,
  results,
  markCompleted = true,
}: {
  searchId: string
  listId: string
  searchType: SearchType
  results: Array<Record<string, unknown>>
  markCompleted?: boolean
}) {
  return prisma.$transaction(async (tx) => {
    const leads = []

    for (const leadData of results) {
      const fields = pickLeadFields(leadData)
      if (typeof fields.email === "string") {
        fields.email = fields.email.trim().toLowerCase()
      }

      const identities = identityFilters(fields, searchType)
      if (identities.length) {
        const existing = await tx.leadListEntry.findFirst({
          where: {
            listId,
            lead: { OR: identities },
          },
          select: { id: true },
        })
        if (existing) continue
      }

      const lead = await tx.lead.create({
        data: {
          ...fields,
          sourceType: searchType,
          emailStatus:
            typeof fields.email === "string" ? "FOUND" : "NOT_FOUND",
        },
      })

      await tx.leadListEntry.create({
        data: { listId, leadId: lead.id },
      })
      leads.push(lead)
    }

    if (markCompleted) {
      await tx.searchHistory.update({
        where: { id: searchId },
        data: { status: "COMPLETED", resultCount: leads.length },
      })
    }

    return leads
  })
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
