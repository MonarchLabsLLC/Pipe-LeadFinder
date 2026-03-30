import { apifyClient } from "@/lib/apify"
import { prisma } from "@/lib/prisma"
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

function buildEmailActorInput(lead: Lead): Record<string, unknown> {
  return {
    firstName: lead.firstName ?? undefined,
    lastName: lead.lastName ?? undefined,
    fullName: lead.fullName ?? undefined,
    company: lead.companyName ?? undefined,
    domain: lead.companyWebsite ?? undefined,
    linkedinUrl: lead.linkedinUrl ?? undefined,
    location: lead.location ?? undefined,
    city: lead.city ?? undefined,
    state: lead.state ?? undefined,
    country: lead.country ?? undefined,
  }
}

function buildPhoneActorInput(lead: Lead): Record<string, unknown> {
  return {
    firstName: lead.firstName ?? undefined,
    lastName: lead.lastName ?? undefined,
    fullName: lead.fullName ?? undefined,
    company: lead.companyName ?? undefined,
    domain: lead.companyWebsite ?? undefined,
    linkedinUrl: lead.linkedinUrl ?? undefined,
    email: lead.email ?? undefined,
    location: lead.location ?? undefined,
    city: lead.city ?? undefined,
    state: lead.state ?? undefined,
    country: lead.country ?? undefined,
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

  const item = items[0]
  const email = (item.email || item.emailAddress || item.contact_email || null) as string | null

  if (!email) {
    return { email: null, emailStatus: "NOT_FOUND" }
  }

  // Some actors indicate confidence/verification status
  const verified = item.verified ?? item.isVerified ?? item.status
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
  const input = buildEmailActorInput(lead)

  const run = await apifyClient.actor(actorId).call(input)
  const { items } = await apifyClient
    .dataset(run.defaultDatasetId)
    .listItems()

  const { email, emailStatus } = parseEmailResult(
    items as Record<string, unknown>[]
  )

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

  for (const entry of entries) {
    try {
      await enrichEmail(entry.leadId)
      enriched++
    } catch {
      // Continue with next lead if one fails
      console.error(`Failed to enrich lead ${entry.leadId}`)
    }
  }

  return { enriched, total: entries.length }
}
