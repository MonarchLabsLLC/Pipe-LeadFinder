/**
 * Server-only. Signed POST to a handoff receiver (Suite or MailBaser).
 */

import { buildSignedHeaders } from "./signing"
import type { HandoffTarget } from "./config"

export const HANDOFF_TIMEOUT_MS = 20_000

export class HandoffError extends Error {
  constructor(
    /** Receiver error code, or one of ours: timeout, network_error, bad_response. */
    public code: string,
    /** HTTP status from the receiver, or 0 when no response arrived. */
    public status: number,
    message: string
  ) {
    super(message)
    this.name = "HandoffError"
  }
}

type FetchLike = typeof fetch

function unwrap(value: unknown): unknown {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "data" in value &&
    Object.keys(value).length <= 2 &&
    !("error" in value && (value as { error?: unknown }).error)
  ) {
    return (value as { data: unknown }).data
  }
  return value
}

function readError(value: unknown): { code?: string; message?: string } {
  if (!value || typeof value !== "object") return {}
  const error = (value as { error?: unknown }).error
  if (typeof error === "string") return { message: error }
  if (error && typeof error === "object") {
    const record = error as { code?: unknown; message?: unknown }
    return {
      code: typeof record.code === "string" ? record.code : undefined,
      message: typeof record.message === "string" ? record.message : undefined,
    }
  }
  return {}
}

export async function postSigned<T>(
  target: HandoffTarget,
  path: string,
  body: { requestId: string } & Record<string, unknown>,
  options: { fetchImpl?: FetchLike; timeoutMs?: number; now?: number } = {}
): Promise<T> {
  const rawBody = JSON.stringify(body)
  const headers = buildSignedHeaders(target.secret, rawBody, {
    requestId: body.requestId,
    now: options.now,
  })
  const doFetch = options.fetchImpl ?? fetch

  let response: Response
  try {
    response = await doFetch(`${target.baseUrl}${path}`, {
      method: "POST",
      headers,
      body: rawBody,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(options.timeoutMs ?? HANDOFF_TIMEOUT_MS),
    })
  } catch (error) {
    const name = error instanceof Error ? error.name : ""
    if (name === "TimeoutError" || name === "AbortError") {
      throw new HandoffError("timeout", 0, `${target.label} did not answer in time. Try again.`)
    }
    throw new HandoffError("network_error", 0, `${target.label} could not be reached. Try again shortly.`)
  }

  const text = await response.text().catch(() => "")
  let parsed: unknown = null
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = null
    }
  }

  if (!response.ok) {
    const { code, message } = readError(parsed)
    throw new HandoffError(
      code ?? (response.status === 404 ? "not_found" : "receiver_error"),
      response.status,
      message ?? `${target.label} answered with status ${response.status}.`
    )
  }

  const data = unwrap(parsed)
  if (!data || typeof data !== "object") {
    throw new HandoffError("bad_response", response.status, `${target.label} sent an unreadable response.`)
  }
  return data as T
}
