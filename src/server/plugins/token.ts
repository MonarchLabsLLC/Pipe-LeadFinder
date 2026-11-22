import { createHash, randomUUID, timingSafeEqual } from "node:crypto"

import { SignJWT, jwtVerify } from "jose"
import { z } from "zod"

import { APP_SERVICE_NAME, GATEWAY_ISSUER } from "./contract"

// The plugin platform's service JWT (contract section 3), both directions.
// HS256 over the one secret this app shares with the ScalePlus dashboard, and
// bound to one request: its method, its path with the query string, the
// SHA-256 of its exact body bytes, 30 seconds and one use.
//
// Pure: no database and no environment. The single-use check is a function the
// caller passes in (the FocusedAgentNonce table in production, a Set in tests).

/** Clock skew tolerated on exp / iat. */
export const TOKEN_SKEW_SECONDS = 5
/** The longest life a token may claim (`exp - iat`). */
export const TOKEN_MAX_LIFETIME_SECONDS = 30

const bounded = z.string().min(1).max(255)

const claimsSchema = z.object({
  iat: z.number().int(),
  exp: z.number().int(),
  jti: bounded,
  method: z.string().min(1).max(10),
  path: z.string().min(1).max(2048),
  bodyHash: z.string().regex(/^[a-f0-9]{64}$/),
  requestId: bounded,
  // The install claims. GET /capabilities describes the app, not an install,
  // so the dashboard may call it without them; every other route requires them
  // (see requireInstallClaims).
  installId: bounded.optional(),
  pluginId: bounded.optional(),
  pluginName: z.string().min(1).max(200).optional(),
  workspaceId: bounded.optional(),
  ownerSubject: bounded.optional(),
  scopes: z.array(z.string().max(200)).max(500).optional(),
  // The owner's monthly Scale Credits cap for this install's work without
  // approval, set in the ScalePlus dashboard. Read through creditCapFromClaims:
  // anything but a non-negative number means "no cap".
  creditCapMonthly: z.unknown().optional(),
})

export type PluginServiceClaims = z.infer<typeof claimsSchema>

export type PluginInstallClaims = PluginServiceClaims & {
  installId: string
  pluginId: string
  pluginName: string
  ownerSubject: string
  scopes: string[]
}

/**
 * The install's monthly cap from the verified token: a non-negative whole
 * number of credits, or null (missing, null or malformed) for "no spending
 * without approval".
 */
export function creditCapFromClaims(claims: Pick<PluginServiceClaims, "creditCapMonthly">): number | null {
  const value = claims.creditCapMonthly
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null
  return Math.floor(value)
}

/** The claims of a call made for one plugin install, or null when any is missing. */
export function requireInstallClaims(claims: PluginServiceClaims): PluginInstallClaims | null {
  if (!claims.installId || !claims.pluginId || !claims.pluginName || !claims.ownerSubject || !claims.scopes) return null
  return claims as PluginInstallClaims
}

export type PluginTokenFailure = "missing" | "signature" | "claims" | "lifetime" | "replay" | "method" | "path" | "body"

export type PluginVerifyResult = { ok: true; claims: PluginServiceClaims } | { ok: false; reason: PluginTokenFailure }

/** SHA-256 hex of the exact body bytes; the hash of "" when there is none. */
export function rawBodyHash(rawBody: string): string {
  return createHash("sha256").update(rawBody, "utf8").digest("hex")
}

function sameDigest(a: string, b: string): boolean {
  return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

function bearer(authorization: string | null): string | null {
  const match = /^Bearer\s+([A-Za-z0-9._-]+)$/.exec(authorization?.trim() ?? "")
  return match ? match[1] : null
}

export interface VerifyPluginTokenInput {
  secret: string
  authorization: string | null
  /** The request's HTTP method. */
  method: string
  /** The pathname plus the query string exactly as it arrived. */
  requestPath: string
  /** The body exactly as it arrived ("" for a GET). */
  rawBody: string
  /** Record the nonce until `expiresAt`; false when it was already used. */
  claimNonce: (jti: string, expiresAt: Date) => Promise<boolean>
  now?: Date
}

/**
 * Verify one dashboard-to-app call in the contract's order: signature, issuer,
 * audience, expiry, nonce, method, path, body hash. Only a token that passed
 * the first four may spend a nonce.
 */
export async function verifyPluginToken(input: VerifyPluginTokenInput): Promise<PluginVerifyResult> {
  const token = bearer(input.authorization)
  if (!token || !input.secret) return { ok: false, reason: "missing" }

  let payload: unknown
  try {
    const verified = await jwtVerify(token, new TextEncoder().encode(input.secret), {
      algorithms: ["HS256"],
      issuer: GATEWAY_ISSUER,
      audience: APP_SERVICE_NAME,
      clockTolerance: TOKEN_SKEW_SECONDS,
      requiredClaims: ["exp", "iat", "jti"],
      currentDate: input.now,
    })
    payload = verified.payload
  } catch {
    return { ok: false, reason: "signature" }
  }

  const parsed = claimsSchema.safeParse(payload)
  if (!parsed.success) return { ok: false, reason: "claims" }
  const claims = parsed.data

  // A token that claims a longer life than the contract allows is refused
  // whatever its expiry says, as is one issued in the future.
  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000)
  if (claims.exp - claims.iat > TOKEN_MAX_LIFETIME_SECONDS || claims.exp <= claims.iat) return { ok: false, reason: "lifetime" }
  if (claims.iat > nowSeconds + TOKEN_SKEW_SECONDS) return { ok: false, reason: "lifetime" }

  const nonceExpiry = new Date((claims.exp + TOKEN_SKEW_SECONDS) * 1000)
  if (!(await input.claimNonce(claims.jti, nonceExpiry))) return { ok: false, reason: "replay" }

  if (claims.method !== input.method.toUpperCase()) return { ok: false, reason: "method" }
  if (claims.path !== input.requestPath) return { ok: false, reason: "path" }
  if (!sameDigest(claims.bodyHash, rawBodyHash(input.rawBody))) return { ok: false, reason: "body" }
  return { ok: true, claims }
}

/** Sign one app-to-dashboard call (events, installs, frame pass). */
export async function signAppToken(input: {
  secret: string
  method: string
  /** Pathname plus query string, exactly as it will be sent. */
  path: string
  rawBody: string
  requestId?: string
  now?: Date
}): Promise<{ token: string; requestId: string }> {
  const issuedAt = Math.floor((input.now ?? new Date()).getTime() / 1000)
  const requestId = input.requestId ?? randomUUID()
  const token = await new SignJWT({
    method: input.method.toUpperCase(),
    path: input.path,
    bodyHash: rawBodyHash(input.rawBody),
    requestId,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(APP_SERVICE_NAME)
    .setAudience(GATEWAY_ISSUER)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + TOKEN_MAX_LIFETIME_SECONDS)
    .setJti(randomUUID())
    .sign(new TextEncoder().encode(input.secret))
  return { token, requestId }
}
