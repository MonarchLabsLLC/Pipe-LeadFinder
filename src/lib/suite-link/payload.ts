/**
 * Server-only. Maps Lead Finder Lead rows to the contract's lead (Suite) and
 * contact (MailBaser) objects. Empty strings become undefined, so a receiver
 * never has to tell "" from "missing". Lengths are clamped to the smaller of
 * the two receivers' limits, so one long scraped value never fails a batch.
 */

export const MAX_LEADS_PER_SEND = 50

/** The Lead columns the mapping reads. */
export type HandoffLeadRow = {
  id: string
  firstName: string | null
  lastName: string | null
  fullName: string | null
  title: string | null
  headline: string | null
  city: string | null
  state: string | null
  country: string | null
  email: string | null
  emailStatus: string
  phone: string | null
  phoneStatus: string
  linkedinUrl: string | null
  companyName: string | null
  companyWebsite: string | null
  companyIndustry: string | null
  companySize: string | null
}

export const HANDOFF_LEAD_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  fullName: true,
  title: true,
  headline: true,
  city: true,
  state: true,
  country: true,
  email: true,
  emailStatus: true,
  phone: true,
  phoneStatus: true,
  linkedinUrl: true,
  companyName: true,
  companyWebsite: true,
  companyIndustry: true,
  companySize: true,
} as const

export type SuiteLead = {
  externalId: string
  firstName?: string
  lastName?: string
  fullName?: string
  email?: string
  phone?: string
  title?: string
  linkedinUrl?: string
  city?: string
  state?: string
  country?: string
  companyName?: string
  companyWebsite?: string
  companyIndustry?: string
  companySize?: string
  sourceListName?: string
}

export type MailbaserContact = {
  externalId: string
  email: string
  firstName?: string
  lastName?: string
  phone?: string
  company?: string
  title?: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function clean(value: string | null | undefined, max = 500): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return trimmed.slice(0, max)
}

/** A usable email: present, not marked NOT_FOUND, and shaped like an email. */
export function bestEmail(lead: Pick<HandoffLeadRow, "email" | "emailStatus">): string | undefined {
  if (lead.emailStatus === "NOT_FOUND") return undefined
  const email = clean(lead.email, 320)?.toLowerCase()
  return email && EMAIL_PATTERN.test(email) ? email : undefined
}

export function bestPhone(lead: Pick<HandoffLeadRow, "phone" | "phoneStatus">): string | undefined {
  if (lead.phoneStatus === "NOT_FOUND") return undefined
  return clean(lead.phone, 50)
}

/** First and last name, split from fullName when the parts are missing. */
export function nameParts(lead: Pick<HandoffLeadRow, "firstName" | "lastName" | "fullName">): {
  firstName?: string
  lastName?: string
  fullName?: string
} {
  let firstName = clean(lead.firstName, 100)
  let lastName = clean(lead.lastName, 100)
  const fullName =
    clean(lead.fullName, 200) ??
    ([firstName, lastName].filter(Boolean).join(" ") || undefined)
  if (!firstName && !lastName && fullName) {
    const [first, ...rest] = fullName.split(/\s+/)
    firstName = first || undefined
    lastName = rest.join(" ") || undefined
  }
  return { firstName, lastName, fullName }
}

function withoutUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  ) as T
}

export function toSuiteLead(lead: HandoffLeadRow, sourceListName?: string | null): SuiteLead {
  return withoutUndefined({
    externalId: lead.id,
    ...nameParts(lead),
    email: bestEmail(lead),
    phone: bestPhone(lead),
    title: clean(lead.title, 200) ?? clean(lead.headline, 200),
    linkedinUrl: clean(lead.linkedinUrl, 2048),
    city: clean(lead.city, 100),
    state: clean(lead.state, 100),
    country: clean(lead.country, 100),
    companyName: clean(lead.companyName, 200),
    companyWebsite: clean(lead.companyWebsite, 2048),
    companyIndustry: clean(lead.companyIndustry, 100),
    companySize: clean(lead.companySize, 50),
    sourceListName: clean(sourceListName, 200),
  })
}

/** Null when the lead has no usable email: MailBaser contacts need one. */
export function toMailbaserContact(lead: HandoffLeadRow): MailbaserContact | null {
  const email = bestEmail(lead)
  if (!email) return null
  const { firstName, lastName } = nameParts(lead)
  return withoutUndefined({
    externalId: lead.id,
    email,
    firstName,
    lastName,
    phone: bestPhone(lead),
    company: clean(lead.companyName, 200),
    title: clean(lead.title, 200) ?? clean(lead.headline, 200),
  })
}
