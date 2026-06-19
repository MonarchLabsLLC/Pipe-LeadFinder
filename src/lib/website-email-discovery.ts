import { extractEmailsFromText } from "@/lib/contact-info"

function asText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

export function normalizeDomain(value: unknown): string | undefined {
  const raw = asText(value)
  if (!raw) return undefined

  const fromEmail = raw.match(/@([a-z0-9.-]+\.[a-z]{2,})/i)?.[1]
  if (fromEmail) return fromEmail.toLowerCase()

  const withoutProtocol = raw
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split(/[/?#]/)[0]
    .trim()
    .toLowerCase()

  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(withoutProtocol)
    ? withoutProtocol
    : undefined
}

export function normalizeWebsiteUrl(value: unknown): string | undefined {
  const raw = asText(value)
  if (!raw) return undefined

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`

  try {
    const url = new URL(withProtocol)
    if (url.hostname.includes("google.") || url.hostname.includes("linkedin.")) {
      return undefined
    }
    return `${url.protocol}//${url.hostname.replace(/^www\./i, "")}`
  } catch {
    const domain = normalizeDomain(raw)
    return domain ? `https://${domain}` : undefined
  }
}

async function fetchPageText(url: string): Promise<string | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "PipeLeadFinder/1.0 (contact@scale.gg)",
        Accept: "text/html,application/xhtml+xml",
      },
    })

    if (!res.ok) return null
    const contentType = res.headers.get("content-type") || ""
    if (!contentType.includes("text/html")) return null

    return await res.text()
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export async function findWebsiteEmails(
  website: unknown,
  maxEmails = 1
): Promise<string[]> {
  const origin = normalizeWebsiteUrl(website)
  const domain = normalizeDomain(origin)
  if (!origin || !domain) return []

  const paths = [
    "",
    "/contact",
    "/contact-us",
    "/about",
    "/about-us",
    "/team",
    "/staff",
    "/privacy",
  ]
  const emails = new Set<string>()

  for (const path of paths) {
    const html = await fetchPageText(`${origin}${path}`)
    if (!html) continue

    for (const email of extractEmailsFromText(html, domain)) {
      emails.add(email)
      if (emails.size >= maxEmails) return Array.from(emails)
    }
  }

  return Array.from(emails)
}
