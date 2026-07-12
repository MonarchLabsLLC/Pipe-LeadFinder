import type { LeadIdentityType, SearchType } from "@/generated/prisma/enums"

export interface NormalizedLeadIdentity {
  type: LeadIdentityType
  value: string
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function normalizedUrl(value: string) {
  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`
    const url = new URL(withProtocol)
    url.hash = ""
    url.search = ""
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "")
    url.pathname = url.pathname.replace(/\/+$/, "").toLowerCase()
    return `${url.hostname}${url.pathname}`
  } catch {
    return value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/+$/, "")
  }
}

export function normalizeLeadIdentities(
  fields: Record<string, unknown>,
  searchType: SearchType
): NormalizedLeadIdentity[] {
  const identities: NormalizedLeadIdentity[] = []
  const email = text(fields.email)?.toLowerCase()
  const linkedinUrl = text(fields.linkedinUrl)
  const platform = text(fields.platform)?.toLowerCase()
  const username = text(fields.username)?.toLowerCase().replace(/^@/, "")
  const companyWebsite = text(fields.companyWebsite)

  if (email) identities.push({ type: "EMAIL", value: email })
  if (linkedinUrl) {
    identities.push({ type: "LINKEDIN", value: normalizedUrl(linkedinUrl) })
  }
  if (platform && username) {
    identities.push({ type: "SOCIAL_USERNAME", value: `${platform}:${username}` })
  }
  if ((searchType === "COMPANY" || searchType === "LOCAL") && companyWebsite) {
    const domain = normalizedUrl(companyWebsite).split("/")[0]
    if (domain) identities.push({ type: "COMPANY_DOMAIN", value: domain })
  }

  return identities.filter(
    (identity, index, all) =>
      all.findIndex(
        (candidate) =>
          candidate.type === identity.type && candidate.value === identity.value
      ) === index
  )
}
