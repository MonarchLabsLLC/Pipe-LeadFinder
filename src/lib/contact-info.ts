const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi
const FILE_EXTENSION_PATTERN = /\.(png|jpe?g|gif|webp|svg|css|js|ico|pdf)$/i

function asText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function normalizeEmail(value: string): string | null {
  const match = value
    .replace(/^mailto:/i, "")
    .match(EMAIL_PATTERN)?.[0]
    ?.toLowerCase()

  if (!match) return null
  if (FILE_EXTENSION_PATTERN.test(match)) return null
  if (match.includes("example.com")) return null

  return match
}

function isContactField(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[_-]/g, "")
  return (
    normalized.includes("email") ||
    normalized.includes("contact") ||
    normalized.includes("bio") ||
    normalized.includes("description") ||
    normalized === "author" ||
    normalized === "owner"
  )
}

function addEmailCandidate(
  emails: Set<string>,
  value: unknown,
  keyHint = false,
  depth = 0
) {
  if (depth > 4 || value == null) return

  const text = asText(value)
  if (text) {
    const email = normalizeEmail(text)
    if (email && (keyHint || text === email || /^mailto:/i.test(text))) {
      emails.add(email)
    }
    return
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      addEmailCandidate(emails, item, keyHint, depth + 1)
    }
    return
  }

  if (typeof value !== "object") return

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const nestedHint = keyHint || isContactField(key)
    if (!nestedHint && depth > 0) continue
    addEmailCandidate(emails, nested, nestedHint, depth + 1)
  }
}

export function extractEmailsFromText(
  text: string,
  preferredDomain?: string
): string[] {
  const matches = text.match(EMAIL_PATTERN) || []
  const unique = new Set<string>()

  for (const match of matches) {
    const email = normalizeEmail(match)
    if (email) unique.add(email)
  }

  return Array.from(unique).sort((a, b) => {
    const aMatchesDomain = preferredDomain && a.endsWith(`@${preferredDomain}`) ? 0 : 1
    const bMatchesDomain = preferredDomain && b.endsWith(`@${preferredDomain}`) ? 0 : 1
    return aMatchesDomain - bMatchesDomain
  })
}

export function extractPrimaryEmail(
  value: Record<string, unknown>,
  preferredDomain?: string
): string | null {
  const emails = new Set<string>()

  addEmailCandidate(emails, value.email, true)
  addEmailCandidate(emails, value.emailAddress, true)
  addEmailCandidate(emails, value.email_address, true)
  addEmailCandidate(emails, value.contact_email, true)
  addEmailCandidate(emails, value.contactEmail, true)
  addEmailCandidate(emails, value.businessEmail, true)
  addEmailCandidate(emails, value.publicEmail, true)
  addEmailCandidate(emails, value.workEmail, true)
  addEmailCandidate(emails, value.primaryEmail, true)
  addEmailCandidate(emails, value.personalEmail, true)
  addEmailCandidate(emails, value.verifiedEmail, true)
  addEmailCandidate(emails, value.emails, true)
  addEmailCandidate(emails, value.emailAddresses, true)
  addEmailCandidate(emails, value.contactEmails, true)
  addEmailCandidate(emails, value.contact, true)
  addEmailCandidate(emails, value.contacts, true)
  addEmailCandidate(emails, value.contactInfo, true)
  addEmailCandidate(emails, value.contact_info, true)
  addEmailCandidate(emails, value.contactDetails, true)
  addEmailCandidate(emails, value.contact_details, true)
  addEmailCandidate(emails, value)

  const sorted = Array.from(emails).sort((a, b) => {
    const aMatchesDomain = preferredDomain && a.endsWith(`@${preferredDomain}`) ? 0 : 1
    const bMatchesDomain = preferredDomain && b.endsWith(`@${preferredDomain}`) ? 0 : 1
    return aMatchesDomain - bMatchesDomain
  })

  return sorted[0] ?? null
}
