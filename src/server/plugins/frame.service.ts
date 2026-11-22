import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { originOfAppUrl, safePluginOrigin } from "@/lib/plugin-frame"
import { resolveWorkspaceScope } from "@/lib/scale-workspace/guest"
import { FocusedAgentError } from "@/server/focused-agent/security"
import { listUrl } from "@/server/focused-agent/resources"

import { decidePluginProposal, pendingPluginProposals, type PluginProposalView } from "./changes"
import { PLUGIN_APP } from "./contract"
import { DashboardError, installsForOwner, requestFramePass, type PluginInstall } from "./dashboard-client"
import { pluginsEnabled } from "./env"

// The session side of the frame (contract section 8): which plugins the owner
// has, a frame pass for one of them, and the owner's decisions on what plugins
// asked for.
//
// Owner only. A Lead Finder account belongs to one person; there is no local
// admin seat on it. A Scale Plus teammate working in the owner's account (a
// guest workspace session) is a member, and is refused.

export class PluginPageError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = "PluginPageError"
  }
}

export interface PluginOwnerSession {
  userId: string
  name: string
  /** Null for an account that has never signed in through ScalePlus (development login). */
  subject: string | null
}

/** The signed-in account owner, or a PluginPageError saying why not. */
export async function requirePluginOwner(): Promise<PluginOwnerSession> {
  if (!pluginsEnabled()) throw new PluginPageError("Plugins are not available.", 404)
  const session = await auth()
  if (!session?.user?.id) throw new PluginPageError("Sign in to open plugins.", 401)
  const scope = await resolveWorkspaceScope(session)
  if (!scope.ok || scope.isGuest) throw new PluginPageError("Only the account owner can open plugins.", 403)
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, name: true, email: true, keycloakSubId: true } })
  if (!user) throw new PluginPageError("Sign in to open plugins.", 401)
  return { userId: user.id, name: user.name?.trim() || user.email, subject: user.keycloakSubId }
}

export interface PluginInstallDto {
  installId: string
  pluginId: string
  name: string
  description: string | null
  iconUrl: string | null
  /** The plugin's origin, when it has a page this app will frame. */
  origin: string | null
}

function toDto(install: PluginInstall): PluginInstallDto {
  return {
    installId: install.installId,
    pluginId: install.pluginId,
    name: install.name,
    description: install.description,
    iconUrl: install.iconUrl && /^https:\/\//.test(install.iconUrl) ? install.iconUrl : null,
    origin: originOfAppUrl(install.appUrl),
  }
}

async function installs(subject: string, fresh: boolean): Promise<PluginInstall[]> {
  try {
    return await installsForOwner(subject, { fresh })
  } catch (error) {
    if (error instanceof DashboardError) throw new PluginPageError("ScalePlus could not list your plugins just now. Try again in a moment.", 503)
    throw error
  }
}

export interface PluginsPageDto {
  installs: PluginInstallDto[]
  proposals: PluginProposalView[]
  /** Why the list is empty when it cannot be anything else, in a sentence. */
  unavailable: string | null
}

export async function listPlugins(): Promise<PluginsPageDto> {
  const owner = await requirePluginOwner()
  const proposals = await pendingPluginProposals(owner.userId)
  if (!owner.subject) return { installs: [], proposals, unavailable: "This account is not linked to ScalePlus yet, so it has no plugins." }
  return { installs: (await installs(owner.subject, true)).map(toDto), proposals, unavailable: null }
}

export interface PluginFrameDto {
  installId: string
  name: string
  pass: string
  expiresIn: number
  appUrl: string
  pluginOrigin: string
  app: typeof PLUGIN_APP
}

/** A fresh 60-second pass for one install, for the owner who is looking. */
export async function getPluginFrame(installId: string): Promise<PluginFrameDto> {
  const owner = await requirePluginOwner()
  if (!owner.subject) throw new PluginPageError("This plugin is not available.", 404)
  const install = (await installs(owner.subject, false)).find((entry) => entry.installId === installId)
  if (!install) throw new PluginPageError("This plugin is not available.", 404)

  let pass
  try {
    pass = await requestFramePass({
      installId,
      ownerSubject: owner.subject,
      tenantId: owner.userId,
      viewer: { subject: owner.subject, name: owner.name, role: "owner" },
    })
  } catch (error) {
    if (error instanceof DashboardError) throw new PluginPageError("ScalePlus could not open this plugin just now. Try again in a moment.", 503)
    throw error
  }

  // The frame only ever loads the origin the dashboard vouches for.
  const pluginOrigin = safePluginOrigin(pass.pluginOrigin)
  if (!pluginOrigin || originOfAppUrl(pass.appUrl) !== pluginOrigin) {
    throw new PluginPageError("This plugin's address is not one Lead Finder can open.", 503)
  }
  return { installId, name: install.name, pass: pass.pass, expiresIn: pass.expiresIn, appUrl: pass.appUrl, pluginOrigin, app: PLUGIN_APP }
}

/** The owner approves or rejects what a plugin asked for. */
export async function decideForOwner(id: string, decision: "approve" | "reject"): Promise<PluginProposalView> {
  const owner = await requirePluginOwner()
  try {
    return await decidePluginProposal({ userId: owner.userId, id, decision })
  } catch (error) {
    if (error instanceof FocusedAgentError) throw new PluginPageError(error.message, error.status === 402 ? 402 : error.status >= 500 ? 503 : error.status)
    throw error
  }
}

/** Where `scale.frame.navigate` goes: a saved list of the owner's, or nowhere. */
export async function resolvePluginNavigation(resource: string, id: string): Promise<{ href: string | null }> {
  const owner = await requirePluginOwner()
  if (resource !== "list") return { href: null }
  const list = await prisma.leadList.findFirst({ where: { id, userId: owner.userId }, select: { id: true } })
  return { href: list ? listUrl(list.id) : null }
}

/** One JSON answer for the session routes, errors included. */
export async function pluginPageResponse<T>(work: () => Promise<T>): Promise<Response> {
  const headers = { "cache-control": "no-store" }
  try {
    return Response.json(await work(), { headers })
  } catch (error) {
    if (error instanceof PluginPageError) return Response.json({ error: error.message }, { status: error.status, headers })
    console.error("[plugins] page request failed", error instanceof Error ? error.message : error)
    return Response.json({ error: "Something went wrong. Try again." }, { status: 500, headers })
  }
}

/** A state-changing session request must come from this app's own pages. */
export function assertSameOrigin(request: Request): void {
  const expected = new URL(process.env.AUTH_URL || process.env.NEXTAUTH_URL || request.url).origin
  if (request.headers.get("origin") !== expected) throw new PluginPageError("Use the Plugins page in Lead Finder.", 403)
}
