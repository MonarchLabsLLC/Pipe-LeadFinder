import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { FocusedAgentError, requireFocusedEntitlement } from "./security"
import { devBypass, devSubject, isDevSubject, DEV_SUBJECT_PREFIX } from "./dev-bypass"

export type AgentActor = {
  userId: string
  workspaceId: string
  subject: string
  email: string
  origin: "native" | "mcp"
}
export const nativeEnabled = () =>
  process.env.LEADFINDER_AGENT_ENABLED === "true"
export const serviceEnabled = () =>
  process.env.LEADFINDER_GODMODE_ENABLED === "true"
export const writesEnabled = () =>
  process.env.LEADFINDER_AGENT_WRITES_ENABLED === "true"

/**
 * Pro Max gate for every Agent request. Fail-closed: any error, timeout or
 * unexpected answer from the entitlement service denies access. The dev
 * bypass only exists under NODE_ENV=development (see dev-bypass.ts).
 */
export async function requireAgentEntitlement(subject: string) {
  const bypass = devBypass()
  if (bypass) {
    if (bypass === "promax") return
    throw new FocusedAgentError(
      "PROMAX_REQUIRED",
      "Active Pro Max access is required for this Agent.",
      403
    )
  }
  if (isDevSubject(subject))
    throw new FocusedAgentError(
      "WORKSPACE_FORBIDDEN",
      "This Lead Finder workspace is not available."
    )
  await requireFocusedEntitlement("leadfinder", subject)
}

export async function resolveActor(
  subject: string,
  origin: AgentActor["origin"],
  workspaceId?: string
): Promise<AgentActor> {
  const dev = isDevSubject(subject) && devBypass() !== null
  const user = dev
    ? await prisma.user.findUnique({
        where: { id: subject.slice(DEV_SUBJECT_PREFIX.length) },
      })
    : isDevSubject(subject)
      ? null
      : await prisma.user.findUnique({ where: { keycloakSubId: subject } })
  if (!user || (workspaceId !== undefined && workspaceId !== user.id))
    throw new FocusedAgentError(
      "WORKSPACE_FORBIDDEN",
      "This Lead Finder workspace is not available."
    )
  await requireAgentEntitlement(subject)
  return {
    userId: user.id,
    workspaceId: user.id,
    subject,
    email: user.email,
    origin,
  }
}
export async function nativeActor(request: Request) {
  if (!nativeEnabled())
    throw new FocusedAgentError(
      "SERVICE_DISABLED",
      "The Lead Finder Agent is not enabled.",
      503
    )
  const session = await auth()
  const bypass = devBypass()
  if (
    !session?.user?.id ||
    (session.authProvider !== "keycloak" && !bypass)
  )
    throw new FocusedAgentError(
      "AUTH_REQUIRED",
      "Sign in again with your verified Keycloak account to use the Agent.",
      401
    )
  if (
    request.method !== "GET" &&
    (request.headers.get("x-focused-agent-action") !== "1" ||
      request.headers.get("origin") !==
        new URL(process.env.AUTH_URL || process.env.NEXTAUTH_URL || request.url)
          .origin)
  ) {
    throw new FocusedAgentError(
      "INVALID_ORIGIN",
      "Use the authenticated Lead Finder Agent panel."
    )
  }
  const local = await prisma.user.findUnique({ where: { id: session.user.id } })
  // Development only: the auto-login user has no Keycloak identity.
  if (local && !local.keycloakSubId && bypass)
    return resolveActor(devSubject(local.id), "native", local.id)
  if (!local?.keycloakSubId)
    throw new FocusedAgentError(
      "AUTH_REQUIRED",
      "A verified Keycloak identity is required.",
      401
    )
  return resolveActor(local.keycloakSubId, "native", local.id)
}
export function assertWrites() {
  if (!writesEnabled())
    throw new FocusedAgentError(
      "WRITES_DISABLED",
      "Paid Agent operations are not enabled.",
      503
    )
}
