import { apifyClient } from "@/lib/apify"
import { prisma } from "@/lib/prisma"
import { extractPrimaryEmail } from "@/lib/contact-info"
import { findWebsiteEmails, normalizeDomain } from "@/lib/website-email-discovery"
import type { Lead } from "@/generated/prisma/client"

// ---------------------------------------------------------------------------
// Actor IDs from environment
// ---------------------------------------------------------------------------

function getEmailActorId(): string {
  const actorId = process.env.APIFY_ACTOR_ENRICH_EMAIL
  if (!actorId)
    throw new Error("APIFY_ACTOR_ENRICH_EMAIL is not configured")
  return actorId
}

function getPhoneActorId(): string {
  const actorId = process.env.APIFY_ACTOR_ENRICH_PHONE
  if (!actorId)
    throw new Error("APIFY_ACTOR_ENRICH_PHONE is not configured")
  return actorId
}

// ---------------------------------------------------------------------------
// Build actor input from lead data
// ---------------------------------------------------------------------------

function cleanDomain(value: string | null): string | undefined {
  return normalizeDomain(value) ?? undefined
}

function buildEmailActorInputs(lead: Lead): Record<string, unknown>[] {
  const inputs: Record<string, unknown>[] = []

  if (lead.linkedinUrl) {
    inputs.push({ linkedin_url: [lead.linkedinUrl] })
  }

  inputs.push({
    firstName: lead.firstName ?? undefined,
    lastName: lead.lastName ?? undefined,
    fullName: lead.fullName ?? undefined,
    company: lead.companyName ?? undefined,
    domain: cleanDomain(lead.companyWebsite),
  })

  return inputs.filter((input) =>
    Object.values(input).some((value) => value !== undefined && value !== null)
  )
}

function buildPhoneActorInput(lead: Lead): Record<string, unknown> {
  // code_crafter/mobile-finder takes linkedin_url array
  if (lead.linkedinUrl) {
    return { linkedin_url: [lead.linkedinUrl] }
  }
  // Fallback
  return {
    firstName: lead.firstName ?? undefined,
    lastName: lead.lastName ?? undefined,
    fullName: lead.fullName ?? undefined,
    company: lead.companyName ?? undefined,
    email: lead.email ?? undefined,
  }
}

// ---------------------------------------------------------------------------
// Parse actor results
// ---------------------------------------------------------------------------

function parseEmailResult(
  items: Record<string, unknown>[]
): { email: string | null; emailStatus: "FOUND" | "NOT_FOUND" | "POTENTIAL" } {
  if (!items.length) {
    return { email: null, emailStatus: "NOT_FOUND" }
  }

  const matchedItem = items.find((candidate) => extractPrimaryEmail(candidate))
  const email = matchedItem ? extractPrimaryEmail(matchedItem) : null

  if (!email) {
    return { email: null, emailStatus: "NOT_FOUND" }
  }

  // Some actors indicate confidence/verification status
  const verified = matchedItem?.verified ?? matchedItem?.isVerified ?? matchedItem?.status
  const status = verified === true || verified === "verified" ? "FOUND" : "POTENTIAL"

  return { email, emailStatus: status }
}

function parsePhoneResult(
  items: Record<string, unknown>[]
): { phone: string | null; phoneStatus: "FOUND" | "NOT_FOUND" } {
  if (!items.length) {
    return { phone: null, phoneStatus: "NOT_FOUND" }
  }

  const item = items[0]
  const phone = (item.phone || item.phoneNumber || item.contact_phone || null) as string | null

  if (!phone) {
    return { phone: null, phoneStatus: "NOT_FOUND" }
  }

  return { phone, phoneStatus: "FOUND" }
}

// ---------------------------------------------------------------------------
// Enrich email for a single lead
// ---------------------------------------------------------------------------

export async function enrichEmail(leadId: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } })
  if (!lead) throw new Error(`Lead not found: ${leadId}`)

  const actorId = getEmailActorId()
  const inputs = buildEmailActorInputs(lead)
  let email: string | null = null
  let emailStatus: "FOUND" | "NOT_FOUND" | "POTENTIAL" = "NOT_FOUND"

  for (const input of inputs) {
    try {
      const run = await apifyClient.actor(actorId).call(input)
      const { items } = await apifyClient
        .dataset(run.defaultDatasetId)
        .listItems()

      const parsed = parseEmailResult(items as Record<string, unknown>[])
      if (parsed.email) {
        email = parsed.email
        emailStatus = parsed.emailStatus
        break
      }
    } catch (error) {
      console.error("Email enrichment actor attempt failed:", error)
    }
  }

  if (!email) {
    const websiteEmails = await findWebsiteEmails(lead.companyWebsite, 1)
    if (websiteEmails[0]) {
      email = websiteEmails[0]
      emailStatus = "POTENTIAL"
    }
  }

  const updated = await prisma.lead.update({
    where: { id: leadId },
    data: {
      email: email ?? lead.email,
      emailStatus,
    },
  })

  return updated
}

// ---------------------------------------------------------------------------
// Enrich phone for a single lead
// ---------------------------------------------------------------------------

export async function enrichPhone(leadId: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } })
  if (!lead) throw new Error(`Lead not found: ${leadId}`)

  const actorId = getPhoneActorId()
  const input = buildPhoneActorInput(lead)

  const run = await apifyClient.actor(actorId).call(input)
  const { items } = await apifyClient
    .dataset(run.defaultDatasetId)
    .listItems()

  const { phone, phoneStatus } = parsePhoneResult(
    items as Record<string, unknown>[]
  )

  const updated = await prisma.lead.update({
    where: { id: leadId },
    data: {
      phone: phone ?? lead.phone,
      phoneStatus,
    },
  })

  return updated
}

// ---------------------------------------------------------------------------
// Bulk enrich all eligible leads in a list
// ---------------------------------------------------------------------------

export async function enrichBulk(listId: string) {
  // Get all leads in this list where email is NOT_FOUND or UNKNOWN
  const entries = await prisma.leadListEntry.findMany({
    where: {
      listId,
      lead: {
        emailStatus: { in: ["NOT_FOUND", "UNKNOWN"] },
      },
    },
    include: { lead: true },
  })

  let enriched = 0
  let attempted = 0
  const batchSize = 3

  for (let index = 0; index < entries.length; index += batchSize) {
    const batch = entries.slice(index, index + batchSize)
    const results = await Promise.all(
      batch.map(async (entry) => {
        try {
          const updated = await enrichEmail(entry.leadId)
          return Boolean(
            updated.email &&
              (updated.emailStatus === "FOUND" || updated.emailStatus === "POTENTIAL")
          )
        } catch {
          // Continue with next lead if one fails
          console.error(`Failed to enrich lead ${entry.leadId}`)
          return false
        }
      })
    )

    attempted += batch.length
    for (const didEnrich of results) {
      if (didEnrich) {
        enriched += 1
      }
    }
  }

  return { enriched, attempted, total: entries.length }
}
