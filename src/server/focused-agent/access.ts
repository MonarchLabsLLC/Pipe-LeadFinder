import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { FocusedAgentError, requireFocusedEntitlement } from "./security"

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

export async function resolveActor(
  subject: string,
  origin: AgentActor["origin"],
  workspaceId?: string
): Promise<AgentActor> {
  const user = await prisma.user.findUnique({
    where: { keycloakSubId: subject },
  })
  if (!user || (workspaceId !== undefined && workspaceId !== user.id))
    throw new FocusedAgentError(
      "WORKSPACE_FORBIDDEN",
      "This Lead Finder workspace is not available."
    )
  await requireFocusedEntitlement("leadfinder", subject)
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
  if (!session?.user?.id || session.authProvider !== "keycloak")
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
