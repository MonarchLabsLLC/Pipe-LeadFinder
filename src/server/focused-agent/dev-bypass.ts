/**
 * Local-development stand-in for the three things the Agent normally checks
 * against other services: the Keycloak identity, the Pro Max entitlement
 * (ClickCampaigns GodMode) and Scale Credits billing.
 *
 * LEADFINDER_AGENT_DEV_BYPASS=promax  -> act as a Pro Max user
 * LEADFINDER_AGENT_DEV_BYPASS=none    -> act as a user without Pro Max (to see the upsell)
 *
 * It is honoured ONLY when NODE_ENV is "development". In any other
 * environment (production, test, a `next start` build) the variable is ignored
 * and every check runs for real, so a stray production variable can never
 * open the Agent.
 */
export type DevBypass = "promax" | "none"

export const DEV_SUBJECT_PREFIX = "dev:"

export function devBypass(env: Record<string, string | undefined> = process.env): DevBypass | null {
  if (env.NODE_ENV !== "development") return null
  const value = env.LEADFINDER_AGENT_DEV_BYPASS?.trim().toLowerCase()
  return value === "promax" || value === "none" ? value : null
}

/** A dev-only subject for a local user that has no Keycloak identity. */
export function devSubject(userId: string) {
  return `${DEV_SUBJECT_PREFIX}${userId}`
}

export function isDevSubject(subject: string) {
  return subject.startsWith(DEV_SUBJECT_PREFIX)
}
