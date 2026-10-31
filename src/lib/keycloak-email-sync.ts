export type SsoEmailSyncUser = { id: string; email: string | null }

export type SsoEmailSyncIdentity = { email?: unknown; email_verified?: unknown }

export type SsoEmailSyncStore = {
  getUserByEmail(email: string): Promise<{ id: string } | null | undefined>
  updateUserEmail(id: string, email: string): Promise<void>
}

export type SsoEmailSyncResult =
  | { status: "unchanged" | "unverified" }
  | { status: "updated"; previousEmail: string | null; email: string }
  | { status: "conflict"; conflictingUserId: string }
  | { status: "failed"; error: string }

export function normalizeSsoEmail(email: unknown) {
  return typeof email === "string" ? email.trim().toLowerCase() : ""
}

/**
 * Keeps the stored login email in step with Keycloak for a user that was
 * already matched by its Keycloak subject. It never matches or merges by email:
 * if the new address belongs to another local user, the old address is kept.
 */
export async function syncSsoEmail(
  user: SsoEmailSyncUser,
  identity: SsoEmailSyncIdentity,
  store: SsoEmailSyncStore,
): Promise<SsoEmailSyncResult> {
  const previousEmail = user.email
  const nextEmail = normalizeSsoEmail(identity.email)
  if (!nextEmail || nextEmail === normalizeSsoEmail(previousEmail)) return { status: "unchanged" }
  if (identity.email_verified !== true) return { status: "unverified" }

  try {
    const owner = await store.getUserByEmail(nextEmail)
    if (owner && owner.id !== user.id) return { status: "conflict", conflictingUserId: owner.id }
    await store.updateUserEmail(user.id, nextEmail)
    return { status: "updated", previousEmail, email: nextEmail }
  } catch (error) {
    const code = (error as { code?: string } | null)?.code
    if (code === "23505" || code === "P2002") return { status: "conflict", conflictingUserId: "unknown" }
    return { status: "failed", error: error instanceof Error ? error.message : String(error) }
  }
}
