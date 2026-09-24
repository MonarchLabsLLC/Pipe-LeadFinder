/**
 * Server-only. Request signing for the Lead Finder one-click handoff to the
 * PipeLeads Suite CRM and MailBaser (wire contract v1).
 *
 * Every request carries:
 *   x-scaleplus-app        pipeleadsfinder
 *   x-scaleplus-timestamp  unix seconds
 *   x-scaleplus-request-id a UUID, equal to body.requestId
 *   x-scaleplus-signature  hex HMAC-SHA256(secret, `${timestamp}.${requestId}.${rawBody}`)
 *
 * Pure functions: no environment, no network.
 */

import { createHmac, timingSafeEqual } from "node:crypto"

export const HANDOFF_APP_ID = "pipeleadsfinder"
export const SIGNATURE_TOLERANCE_SECONDS = 300

export const HANDOFF_HEADERS = {
  app: "x-scaleplus-app",
  timestamp: "x-scaleplus-timestamp",
  requestId: "x-scaleplus-request-id",
  signature: "x-scaleplus-signature",
} as const

export function signHandoff(
  secret: string,
  timestamp: string,
  requestId: string,
  rawBody: string
): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${requestId}.${rawBody}`)
    .digest("hex")
}

export function buildSignedHeaders(
  secret: string,
  rawBody: string,
  options: { requestId: string; now?: number }
): Record<string, string> {
  const timestamp = String(Math.floor((options.now ?? Date.now()) / 1000))
  return {
    "content-type": "application/json",
    [HANDOFF_HEADERS.app]: HANDOFF_APP_ID,
    [HANDOFF_HEADERS.timestamp]: timestamp,
    [HANDOFF_HEADERS.requestId]: options.requestId,
    [HANDOFF_HEADERS.signature]: signHandoff(
      secret,
      timestamp,
      options.requestId,
      rawBody
    ),
  }
}

/**
 * Receiver-side check, used by the tests to prove a round trip. Mirrors what
 * the Suite and MailBaser do: app header, timestamp window, constant-time
 * signature compare over the exact raw body.
 */
export function verifySignedRequest(
  secret: string,
  headers: Record<string, string | undefined>,
  rawBody: string,
  now = Date.now()
): boolean {
  const lower = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  )
  if (lower[HANDOFF_HEADERS.app] !== HANDOFF_APP_ID) return false
  const timestamp = lower[HANDOFF_HEADERS.timestamp] ?? ""
  const requestId = lower[HANDOFF_HEADERS.requestId] ?? ""
  const signature = lower[HANDOFF_HEADERS.signature] ?? ""
  if (!/^\d+$/.test(timestamp) || !requestId) return false
  if (Math.abs(now / 1000 - Number(timestamp)) > SIGNATURE_TOLERANCE_SECONDS) {
    return false
  }
  if (!/^[a-f0-9]{64}$/.test(signature)) return false
  const expected = signHandoff(secret, timestamp, requestId, rawBody)
  return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"))
}
