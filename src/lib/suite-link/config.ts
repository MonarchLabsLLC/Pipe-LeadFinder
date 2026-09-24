/**
 * Server-only. Which one-click handoff targets are configured.
 *
 * A target is enabled only when its base URL is set AND its shared secret is
 * at least 32 characters. Otherwise the buttons are hidden and the routes
 * answer 404.
 */

export type HandoffTargetName = "pipeleads" | "mailbaser"

export type HandoffTarget = {
  name: HandoffTargetName
  /** Display name used in messages. */
  label: string
  baseUrl: string
  secret: string
}

export const MIN_SECRET_LENGTH = 32

const ENV = {
  pipeleads: {
    label: "PipeLeads",
    url: "PIPELEADS_SUITE_URL",
    secret: "LEADFINDER_SUITE_SERVICE_SECRET",
  },
  mailbaser: {
    label: "MailBaser",
    url: "MAILBASER_URL",
    secret: "LEADFINDER_MAILBASER_SERVICE_SECRET",
  },
} as const

export function normalizeBaseUrl(value: string | undefined): string | null {
  const trimmed = (value ?? "").trim().replace(/\/+$/, "")
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    if (url.protocol !== "https:" && url.protocol !== "http:") return null
    return trimmed
  } catch {
    return null
  }
}

export function getHandoffTarget(
  name: HandoffTargetName,
  env: Record<string, string | undefined> = process.env
): HandoffTarget | null {
  const keys = ENV[name]
  const baseUrl = normalizeBaseUrl(env[keys.url])
  const secret = env[keys.secret] ?? ""
  if (!baseUrl || secret.length < MIN_SECRET_LENGTH) return null
  return { name, label: keys.label, baseUrl, secret }
}

export function getHandoffStatus(
  env: Record<string, string | undefined> = process.env
): Record<HandoffTargetName, boolean> {
  return {
    pipeleads: getHandoffTarget("pipeleads", env) !== null,
    mailbaser: getHandoffTarget("mailbaser", env) !== null,
  }
}

/** Where the "Open" action in the success toast goes. */
export function contactsUrl(target: HandoffTarget): string {
  return target.name === "pipeleads"
    ? `${target.baseUrl}/crm/contacts`
    : `${target.baseUrl}/contacts`
}
