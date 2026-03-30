/**
 * Server-side Keycloak JWT verification using jose.
 * Adapted from blogbaser's keycloakAuth.ts for Next.js API routes.
 */

import { createRemoteJWKSet, jwtVerify, decodeJwt, type JWTPayload } from "jose"

const KEYCLOAK_URL =
  process.env.NEXT_PUBLIC_KEYCLOAK_URL || ""
const KEYCLOAK_REALM =
  process.env.NEXT_PUBLIC_KEYCLOAK_REALM || ""
const KEYCLOAK_CLIENT_ID =
  process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || ""

const REQUIRED_ROLE = "App_pipefinder"

export interface KeycloakClaims extends JWTPayload {
  sub: string
  email?: string
  given_name?: string
  family_name?: string
  name?: string
  preferred_username?: string
  picture?: string
  azp?: string
  realm_access?: {
    roles: string[]
  }
}

// Create JWKS (JSON Web Key Set) fetcher — caches keys and handles rotation
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null

function getJWKS() {
  if (!jwks) {
    if (!KEYCLOAK_URL || !KEYCLOAK_REALM) {
      throw new Error("Keycloak URL and realm must be configured")
    }
    const jwksUrl = new URL(
      `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/certs`
    )
    jwks = createRemoteJWKSet(jwksUrl)
  }
  return jwks
}

/**
 * Verify and decode JWT against Keycloak's JWKS endpoint.
 *
 * Keycloak sets aud="account" by default, not the client ID.
 * The client ID is in the azp (authorized party) claim instead.
 * Only verify issuer and signature — check azp manually after.
 */
export async function verifyToken(
  token: string,
  { skipAzpCheck = false } = {}
): Promise<KeycloakClaims> {
  const keySet = getJWKS()

  const { payload } = await jwtVerify(token, keySet, {
    issuer: `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}`,
  })

  // Verify the token was issued for our client
  if (
    !skipAzpCheck &&
    KEYCLOAK_CLIENT_ID &&
    payload.azp &&
    payload.azp !== KEYCLOAK_CLIENT_ID
  ) {
    throw new Error(
      `Token azp "${payload.azp}" does not match expected client "${KEYCLOAK_CLIENT_ID}"`
    )
  }

  return payload as KeycloakClaims
}

/**
 * Fallback: decode-only for environments where Keycloak JWKS is unreachable.
 */
export function decodeTokenUnsafe(token: string): KeycloakClaims {
  return decodeJwt(token) as KeycloakClaims
}

/**
 * Verify a Keycloak JWT and check for the required App_pipefinder role.
 * In dev mode, falls back to decode-only if JWKS is unreachable.
 * Returns the verified claims or throws.
 */
export async function verifyKeycloakToken(token: string): Promise<KeycloakClaims> {
  let claims: KeycloakClaims

  try {
    claims = await verifyToken(token)
  } catch (verifyError) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[KeycloakVerify] JWT verification failed, falling back to decode-only (dev mode):",
        verifyError
      )
      claims = decodeTokenUnsafe(token)
    } else {
      throw verifyError
    }
  }

  // Check for required role
  const roles = claims.realm_access?.roles || []
  if (!roles.includes(REQUIRED_ROLE)) {
    throw new Error(`Forbidden — missing required role: ${REQUIRED_ROLE}`)
  }

  return claims
}
