/**
 * Sealed (AES-256-GCM encrypted, HttpOnly) workspace session cookie.
 *
 * This app's Auth.js session is a stateless encrypted JWT cookie, so the
 * framework-natural "server-side session" is another sealed HttpOnly cookie
 * keyed off AUTH_SECRET. The payload is never readable by JavaScript, never
 * placed in localStorage, and never persisted to the database.
 *
 * WebCrypto only — usable from both the request proxy and Node route handlers.
 */

import {
  SCALE_WORKSPACE_APP_SLUG,
  isWorkspaceContextV1,
  type WorkspaceContextV1,
} from "./contract"

export const WORKSPACE_COOKIE_NAME = "scale-workspace-session"

/** Hard cap; the real gate is the per-request central authorize call. */
export const WORKSPACE_SESSION_MAX_AGE_SECONDS = 12 * 60 * 60

export type SealedWorkspaceSession = {
  v: 1
  context: WorkspaceContextV1
  /** Local User.id of the bound workspace owner (resource tenant). */
  ownerUserId: string
  /** Local User.id of the signed-in member (the actor — never the owner). */
  actorUserId: string
  /** Keycloak subject verified at exchange time. */
  actorKeycloakSubject: string
  allowedApplications: string[]
  /** Issued-at, epoch seconds. */
  iat: number
}

let cachedKey: CryptoKey | null = null
let cachedSecret: string | null = null

async function sealKey(): Promise<CryptoKey> {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    throw new Error("AUTH_SECRET is required to seal workspace sessions")
  }
  if (cachedKey && cachedSecret === secret) return cachedKey
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${secret}:scale-workspace-session-v1`)
  )
  cachedKey = await crypto.subtle.importKey(
    "raw",
    digest,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  )
  cachedSecret = secret
  return cachedKey
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromBase64Url(value: string): Uint8Array | null {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/")
    const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4))
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

export async function sealWorkspaceSession(
  payload: Omit<SealedWorkspaceSession, "v" | "iat">
): Promise<string> {
  const key = await sealKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = new TextEncoder().encode(
    JSON.stringify({
      ...payload,
      v: 1,
      iat: Math.floor(Date.now() / 1000),
    } satisfies SealedWorkspaceSession)
  )
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext)
  )
  const combined = new Uint8Array(iv.length + ciphertext.length)
  combined.set(iv, 0)
  combined.set(ciphertext, iv.length)
  return toBase64Url(combined)
}

export async function unsealWorkspaceSession(
  value: string
): Promise<SealedWorkspaceSession | null> {
  if (!value || value.length > 8192) return null
  const combined = fromBase64Url(value)
  if (!combined || combined.length <= 12) return null
  try {
    const key = await sealKey()
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: combined.slice(0, 12) },
      key,
      combined.slice(12)
    )
    const parsed = JSON.parse(new TextDecoder().decode(plaintext)) as unknown
    if (!parsed || typeof parsed !== "object") return null
    const sealed = parsed as SealedWorkspaceSession
    if (
      sealed.v !== 1 ||
      typeof sealed.ownerUserId !== "string" ||
      sealed.ownerUserId.length === 0 ||
      typeof sealed.actorUserId !== "string" ||
      sealed.actorUserId.length === 0 ||
      typeof sealed.actorKeycloakSubject !== "string" ||
      sealed.actorKeycloakSubject.length === 0 ||
      !Array.isArray(sealed.allowedApplications) ||
      typeof sealed.iat !== "number" ||
      !isWorkspaceContextV1(sealed.context, SCALE_WORKSPACE_APP_SLUG) ||
      sealed.context.actor.keycloakSubject !== sealed.actorKeycloakSubject
    ) {
      return null
    }
    const ageSeconds = Math.floor(Date.now() / 1000) - sealed.iat
    if (ageSeconds < 0 || ageSeconds > WORKSPACE_SESSION_MAX_AGE_SECONDS) {
      return null
    }
    return sealed
  } catch {
    return null
  }
}

export function workspaceCookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: WORKSPACE_SESSION_MAX_AGE_SECONDS,
  }
}
