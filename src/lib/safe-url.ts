import { lookup } from "node:dns/promises"
import { request as httpRequest } from "node:http"
import { request as httpsRequest } from "node:https"
import { isIP } from "node:net"
import { Readable } from "node:stream"

const BLOCKED_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".home",
  ".lan",
  ".test",
]

function isPublicIpv4(address: string) {
  const parts = address.split(".").map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false
  }

  const [a, b] = parts
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false
  if (a === 100 && b >= 64 && b <= 127) return false
  if (a === 169 && b === 254) return false
  if (a === 172 && b >= 16 && b <= 31) return false
  if (a === 192 && (b === 0 || b === 168)) return false
  if (a === 198 && (b === 18 || b === 19 || b === 51)) return false
  if (a === 203 && b === 0) return false
  return true
}

function isPublicIpv6(address: string) {
  const normalized = address.toLowerCase()
  if (normalized === "::" || normalized === "::1") return false
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return false
  if (/^fe[89ab]/.test(normalized)) return false
  if (normalized.startsWith("ff")) return false
  if (normalized.startsWith("2001:db8:")) return false
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice("::ffff:".length)
    return isIP(mapped) === 4 && isPublicIpv4(mapped)
  }
  return true
}

function isPublicIp(address: string) {
  const version = isIP(address)
  if (version === 4) return isPublicIpv4(address)
  if (version === 6) return isPublicIpv6(address)
  return false
}

export function parseHttpUrl(value: string) {
  const url = new URL(value)
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS URLs are allowed")
  }
  if (url.username || url.password) {
    throw new Error("URLs containing credentials are not allowed")
  }
  return url
}

async function resolveSafePublicUrl(value: string) {
  const url = parseHttpUrl(value)
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase()

  if (
    hostname === "localhost" ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  ) {
    throw new Error("Local and private network URLs are not allowed")
  }

  if (isIP(hostname)) {
    if (!isPublicIp(hostname)) {
      throw new Error("Local and private network URLs are not allowed")
    }
    return { url, address: hostname }
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true })
  if (!addresses.length || addresses.some(({ address }) => !isPublicIp(address))) {
    throw new Error("URL must resolve only to public internet addresses")
  }

  return { url, address: addresses[0].address }
}

/** Resolve and reject local, private, reserved, and non-HTTP destinations. */
export async function assertSafePublicUrl(value: string) {
  return (await resolveSafePublicUrl(value)).url
}

function requestBody(body: BodyInit | null | undefined) {
  if (body == null) return null
  if (typeof body === "string") return Buffer.from(body)
  if (body instanceof URLSearchParams) return Buffer.from(body.toString())
  if (body instanceof ArrayBuffer) return Buffer.from(body)
  if (ArrayBuffer.isView(body)) {
    return Buffer.from(body.buffer, body.byteOffset, body.byteLength)
  }
  throw new Error("Unsupported request body type")
}

async function pinnedRequest(
  url: URL,
  address: string,
  options: RequestInit,
  timeoutMs: number
) {
  const body = requestBody(options.body)
  const headers = new Headers(options.headers)
  headers.set("host", url.host)
  if (body && !headers.has("content-length")) {
    headers.set("content-length", String(body.byteLength))
  }

  return new Promise<Response>((resolve, reject) => {
    const requester = url.protocol === "https:" ? httpsRequest : httpRequest
    const request = requester(
      {
        protocol: url.protocol,
        hostname: address,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method: options.method || "GET",
        headers: Object.fromEntries(headers.entries()),
        ...(url.protocol === "https:"
          ? { servername: url.hostname, rejectUnauthorized: true }
          : {}),
      },
      (incoming) => {
        cleanup()
        incoming.setTimeout(timeoutMs, () => {
          incoming.destroy(new DOMException("Request timed out", "AbortError"))
        })

        const responseHeaders = new Headers()
        for (const [name, value] of Object.entries(incoming.headers)) {
          if (Array.isArray(value)) {
            for (const item of value) responseHeaders.append(name, item)
          } else if (value !== undefined) {
            responseHeaders.set(name, value)
          }
        }

        const status = incoming.statusCode ?? 500
        const hasBody = status !== 204 && status !== 205 && status !== 304
        const stream = hasBody
          ? (Readable.toWeb(incoming) as ReadableStream<Uint8Array>)
          : null
        resolve(
          new Response(stream, {
            status,
            statusText: incoming.statusMessage,
            headers: responseHeaders,
          })
        )
      }
    )

    const abort = () => {
      request.destroy(new DOMException("Request aborted", "AbortError"))
    }
    const cleanup = () => {
      clearTimeout(timeout)
      options.signal?.removeEventListener("abort", abort)
    }
    const timeout = setTimeout(abort, timeoutMs)

    request.once("error", (error) => {
      cleanup()
      reject(error)
    })
    if (options.signal?.aborted) {
      abort()
      return
    }
    options.signal?.addEventListener("abort", abort, { once: true })
    if (body) request.write(body)
    request.end()
  })
}

export async function safeFetch(
  value: string,
  options: RequestInit = {},
  settings: { timeoutMs?: number; maxRedirects?: number } = {}
) {
  const timeoutMs = settings.timeoutMs ?? 10_000
  const maxRedirects = settings.maxRedirects ?? 0
  let resolved = await resolveSafePublicUrl(value)

  for (let redirectCount = 0; ; redirectCount += 1) {
    const response = await pinnedRequest(
      resolved.url,
      resolved.address,
      options,
      timeoutMs
    )

    if (
      response.status < 300 ||
      response.status >= 400 ||
      !response.headers.get("location")
    ) {
      return response
    }

    if (redirectCount >= maxRedirects) {
      throw new Error("Too many redirects")
    }

    resolved = await resolveSafePublicUrl(
      new URL(response.headers.get("location")!, resolved.url).toString()
    )
  }
}

export async function readLimitedText(
  response: Response,
  maxBytes = 2 * 1024 * 1024
) {
  const declaredLength = Number(response.headers.get("content-length"))
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error("Response is too large")
  }

  if (!response.body) return ""

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let received = 0
  let text = ""

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.byteLength
      if (received > maxBytes) throw new Error("Response is too large")
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
    return text
  } finally {
    reader.releaseLock()
  }
}
