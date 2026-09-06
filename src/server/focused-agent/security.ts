import { createHash, randomUUID, timingSafeEqual } from "node:crypto"
import { jwtVerify, SignJWT } from "jose"

export const FOCUSED_APPS = [
  "chatbaser",
  "leadfinder",
  "pipeleads",
  "webinarbaser",
] as const
export type FocusedApp = (typeof FOCUSED_APPS)[number]
export type ApprovalEvidence = {
  mode: "mcp-elicitation"
  proposalId: string
  proposalHash: string
}
export type FocusedClaims = {
  sub: string
  iss: string
  aud: string
  iat: number
  exp: number
  jti: string
  action: string
  path: string
  bodyHash: string
  sessionId: string
  requestId: string
  nonce: string
  approval?: ApprovalEvidence
}

export class FocusedAgentError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 403,
    public retryable = false
  ) {
    super(message)
    this.name = "FocusedAgentError"
  }
}

export function canonicalJson(value: unknown): string {
  const normalize = (item: unknown): unknown => {
    if (item === null || typeof item === "string" || typeof item === "boolean")
      return item
    if (typeof item === "number" && Number.isFinite(item)) return item
    if (Array.isArray(item))
      return item.map((v) => normalize(v === undefined ? null : v))
    if (
      item &&
      typeof item === "object" &&
      Object.getPrototypeOf(item) === Object.prototype
    ) {
      const record = item as Record<string, unknown>
      const result: Record<string, unknown> = Object.create(null)
      for (const key of Object.keys(record).sort())
        if (record[key] !== undefined) result[key] = normalize(record[key])
      return result
    }
    throw new TypeError("Expected JSON data")
  }
  return JSON.stringify(normalize(value))
}
export function hashCanonical(value: unknown) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex")
}
export function exactHash(a: unknown, b: unknown): boolean {
  return (
    typeof a === "string" &&
    typeof b === "string" &&
    /^[a-f0-9]{64}$/.test(a) &&
    /^[a-f0-9]{64}$/.test(b) &&
    timingSafeEqual(Buffer.from(a), Buffer.from(b))
  )
}
function signingKey(secret: string | undefined) {
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new FocusedAgentError(
      "SERVICE_NOT_CONFIGURED",
      "Agent service signing is not configured.",
      503
    )
  }
  return new TextEncoder().encode(secret)
}
export async function signFocusedRequest(params: {
  secret: string
  issuer: string
  audience: string
  subject: string
  action: string
  path: string
  body: unknown
  sessionId?: string
  requestId?: string
  approval?: ApprovalEvidence
  now?: number
  nonce?: string
}) {
  const now = params.now ?? Math.floor(Date.now() / 1000)
  const nonce = params.nonce ?? randomUUID()
  return new SignJWT({
    action: params.action,
    path: params.path,
    bodyHash: hashCanonical(params.body),
    sessionId: params.sessionId ?? nonce,
    requestId: params.requestId ?? nonce,
    nonce,
    ...(params.approval ? { approval: params.approval } : {}),
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(params.issuer)
    .setAudience(params.audience)
    .setSubject(params.subject)
    .setJti(nonce)
    .setIssuedAt(now)
    .setExpirationTime(now + 30)
    .sign(signingKey(params.secret))
}

/** Database-backed nonce insertion MUST be atomic; false means a unique-key collision. */
export async function verifyFocusedRequest(params: {
  authorization: string | null | undefined
  secret: string | undefined
  issuer: string
  audience: string
  action: string
  path: string
  body: unknown
  consumeNonce: (claims: FocusedClaims) => Promise<boolean>
  now?: number
}): Promise<FocusedClaims> {
  const key = signingKey(params.secret)
  if (!params.authorization?.startsWith("Bearer ")) {
    throw new FocusedAgentError(
      "AUTH_REQUIRED",
      "A signed service request is required.",
      401
    )
  }
  const now = params.now ?? Math.floor(Date.now() / 1000)
  let payload: Record<string, unknown>
  try {
    ;({ payload } = await jwtVerify(params.authorization.slice(7), key, {
      algorithms: ["HS256"],
      typ: "JWT",
      issuer: params.issuer,
      audience: params.audience,
      currentDate: new Date(now * 1000),
      maxTokenAge: 30,
      clockTolerance: 2,
      requiredClaims: [
        "sub",
        "iat",
        "exp",
        "jti",
        "action",
        "path",
        "bodyHash",
        "sessionId",
        "requestId",
        "nonce",
      ],
    }))
  } catch {
    throw new FocusedAgentError(
      "INVALID_SERVICE_TOKEN",
      "The signed request is invalid or expired.",
      401
    )
  }
  const strings = [
    "sub",
    "action",
    "path",
    "bodyHash",
    "sessionId",
    "requestId",
    "nonce",
    "jti",
  ]
  if (
    strings.some(
      (k) =>
        typeof payload[k] !== "string" ||
        !(payload[k] as string).length ||
        (payload[k] as string).length > 500
    ) ||
    typeof payload.iat !== "number" ||
    typeof payload.exp !== "number" ||
    !Number.isInteger(payload.iat) ||
    !Number.isInteger(payload.exp) ||
    payload.exp <= now ||
    payload.iat > now + 2 ||
    payload.exp <= payload.iat ||
    payload.exp - payload.iat > 30 ||
    payload.nonce !== payload.jti ||
    (payload.nonce as string).length < 16 ||
    payload.aud !== params.audience
  ) {
    throw new FocusedAgentError(
      "INVALID_SERVICE_CLAIMS",
      "The signed request claims are invalid.",
      401
    )
  }
  if (
    payload.action !== params.action ||
    payload.path !== params.path ||
    !exactHash(payload.bodyHash, hashCanonical(params.body))
  ) {
    throw new FocusedAgentError(
      "REQUEST_BINDING_MISMATCH",
      "The signed request does not match this operation.",
      401
    )
  }
  const body = params.body as Record<string, unknown> | null
  if (body?.lineage) {
    const lineage = body.lineage as Record<string, unknown>
    if (
      lineage.mcpSessionId !== payload.sessionId ||
      lineage.requestId !== payload.requestId
    ) {
      throw new FocusedAgentError(
        "LINEAGE_MISMATCH",
        "The request lineage does not match.",
        401
      )
    }
  }
  if (payload.approval !== undefined) {
    const approval = payload.approval as ApprovalEvidence
    if (
      !approval ||
      approval.mode !== "mcp-elicitation" ||
      typeof approval.proposalId !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(approval.proposalId) ||
      !exactHash(approval.proposalHash, approval.proposalHash)
    ) {
      throw new FocusedAgentError(
        "INVALID_APPROVAL",
        "Approval evidence is invalid.",
        401
      )
    }
  }
  const claims = payload as FocusedClaims
  if (!(await params.consumeNonce(claims))) {
    throw new FocusedAgentError(
      "NONCE_REPLAY",
      "This signed request has already been used.",
      409
    )
  }
  return claims
}

export function trustedServiceUrl(base: string | undefined, path: string): URL {
  if (!base)
    throw new FocusedAgentError(
      "SERVICE_NOT_CONFIGURED",
      "The Agent connection is not configured.",
      503
    )
  const url = new URL(base)
  const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !["https:", "http:"].includes(url.protocol) ||
    (url.protocol !== "https:" && !loopback)
  ) {
    throw new FocusedAgentError(
      "INSECURE_SERVICE_URL",
      "Agent services require HTTPS or loopback.",
      503
    )
  }
  return new URL(path, url)
}

/** No positive entitlement cache: a revoked plan fails the next request closed. */
export async function requireFocusedEntitlement(
  app: FocusedApp,
  subject: string
): Promise<void> {
  const path = `/api/internal/godmode/entitlement/${app}`
  const body = { protocolVersion: "1", subject }
  const secret = process.env[`${app.toUpperCase()}_GODMODE_SERVICE_SECRET`]
  signingKey(secret)
  const url = trustedServiceUrl(
    process.env.CLICKCAMPAIGNS_GODMODE_BASE_URL,
    path
  )
  const token = await signFocusedRequest({
    secret: secret!,
    issuer: `${app}-godmode-service`,
    audience: "clickcampaigns-godmode-entitlement",
    subject,
    action: "entitlement",
    path,
    body,
  })
  let response: Response
  try {
    response = await fetch(url, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw new FocusedAgentError(
      "ENTITLEMENT_UNAVAILABLE",
      "Pro Max access could not be verified. Please try again.",
      503,
      true
    )
  }
  const envelope = (await response.json().catch(() => null)) as {
    protocolVersion?: unknown
    data?: {
      subject?: unknown
      active?: unknown
      godmode?: unknown
      suspended?: unknown
      destinationAccess?: unknown
    }
  } | null
  if (
    !response.ok ||
    envelope?.protocolVersion !== "1" ||
    envelope?.data?.subject !== subject ||
    envelope?.data?.active !== true ||
    envelope?.data?.godmode !== true ||
    envelope?.data?.suspended !== false ||
    envelope?.data?.destinationAccess !== true
  ) {
    throw new FocusedAgentError(
      "PROMAX_REQUIRED",
      "Active Pro Max access is required for this Agent.",
      403
    )
  }
}
