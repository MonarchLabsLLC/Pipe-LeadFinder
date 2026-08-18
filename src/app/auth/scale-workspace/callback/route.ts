/**
 * Scale Plus team workspace launch callback.
 *
 * GET /auth/scale-workspace/callback?scale_workspace_code=...
 *
 * The central hub redirects the member's browser here with a single-use,
 * app-bound launch code (2 minute expiry). The code is exchanged server-side,
 * the CURRENT signed-in Keycloak subject must equal the returned actor, the
 * opaque workspace id is bound to exactly one existing local owner tenant,
 * and the validated context is stored ONLY in a sealed HttpOnly cookie.
 *
 * Returns 404 while SCALE_TEAM_WORKSPACES_ENABLED is not "true".
 */

import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import {
  exchangeWorkspaceLaunchCode,
  isScaleTeamWorkspacesEnabled,
} from "@/lib/scale-workspace/hub"
import {
  WORKSPACE_COOKIE_NAME,
  sealWorkspaceSession,
  workspaceCookieOptions,
} from "@/lib/scale-workspace/session-cookie"

export const dynamic = "force-dynamic"

/**
 * Page that completes sign-in (KeycloakProvider bridges the session) and then
 * bounces back here via the ScaleWorkspaceBridge client component. The raw
 * code stays in the query string only — it is never logged or persisted.
 */
const SIGN_IN_RESUME_PATH = "/lead-search/new-search"

export async function GET(req: NextRequest) {
  if (!isScaleTeamWorkspacesEnabled()) {
    return new NextResponse("Not found", { status: 404 })
  }

  const code = req.nextUrl.searchParams.get("scale_workspace_code") || ""
  if (!code || code.length > 256) {
    return new NextResponse("Invalid workspace launch code", { status: 400 })
  }

  const session = await auth()
  if (!session?.user?.id) {
    // Preserve the code through the app's normal sign-in flow. Single-use and
    // 2-minute semantics are unchanged — the code is only ever sent to the hub
    // once, below, after the member has a verified session.
    const resume = new URL(SIGN_IN_RESUME_PATH, req.nextUrl.origin)
    resume.searchParams.set("scale_workspace_code", code)
    return NextResponse.redirect(resume)
  }

  // The destination's CURRENT authenticated Keycloak subject must match the
  // actor in the exchanged context before anything is stored.
  const actorUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, keycloakSubId: true },
  })
  if (!actorUser?.keycloakSubId) {
    return new NextResponse(
      "Workspace launch requires a Keycloak-linked account",
      { status: 403 }
    )
  }

  let exchange
  try {
    exchange = await exchangeWorkspaceLaunchCode(code)
  } catch {
    return new NextResponse("Workspace launch is temporarily unavailable", {
      status: 503,
    })
  }
  if (!exchange) {
    return new NextResponse("Workspace launch code was rejected", {
      status: 403,
    })
  }
  const { context, returnPath, allowedApplications } = exchange

  if (context.actor.keycloakSubject !== actorUser.keycloakSubId) {
    return new NextResponse("Workspace actor mismatch", { status: 403 })
  }

  // Map the opaque workspace id to ONE existing local owner tenant. Owner data
  // is bound in place — rows are never copied or reassigned.
  const ownerEmail = context.owner.email.trim().toLowerCase()
  let owner = await prisma.user.findUnique({
    where: { keycloakSubId: context.owner.keycloakSubject },
    select: { id: true },
  })
  if (!owner) {
    const byEmail = await prisma.user.findUnique({
      where: { email: ownerEmail },
      select: { id: true, keycloakSubId: true },
    })
    if (byEmail && !byEmail.keycloakSubId) {
      owner = await prisma.user.update({
        where: { id: byEmail.id },
        data: { keycloakSubId: context.owner.keycloakSubject },
        select: { id: true },
      })
    } else if (!byEmail) {
      owner = await prisma.user.create({
        data: {
          email: ownerEmail,
          name: context.owner.displayName || null,
          keycloakSubId: context.owner.keycloakSubject,
          role: "user",
        },
        select: { id: true },
      })
    } else {
      // Email exists but is linked to a different Keycloak subject.
      return new NextResponse("Workspace owner account conflict", {
        status: 409,
      })
    }
  }

  try {
    const existing = await prisma.$queryRaw<Array<{ ownerUserId: string }>>(
      Prisma.sql`SELECT "ownerUserId" FROM "ScaleWorkspaceBinding" WHERE "workspaceId" = ${context.workspace.id} LIMIT 1`
    )
    if (existing[0] && existing[0].ownerUserId !== owner.id) {
      return new NextResponse("Workspace binding conflict", { status: 409 })
    }
    await prisma.$executeRaw(
      Prisma.sql`INSERT INTO "ScaleWorkspaceBinding" ("workspaceId", "ownerUserId")
        VALUES (${context.workspace.id}, ${owner.id})
        ON CONFLICT ("workspaceId")
        DO UPDATE SET "updatedAt" = CURRENT_TIMESTAMP
        WHERE "ScaleWorkspaceBinding"."ownerUserId" = EXCLUDED."ownerUserId"`
    )
  } catch {
    // Unique(ownerUserId) violation (owner already bound to another workspace)
    // or missing table (migration not yet approved/applied): fail closed.
    return new NextResponse("Workspace binding is unavailable", { status: 503 })
  }

  const sealed = await sealWorkspaceSession({
    context,
    ownerUserId: owner.id,
    actorUserId: actorUser.id,
    actorKeycloakSubject: actorUser.keycloakSubId,
    allowedApplications,
  })

  const response = NextResponse.redirect(new URL(returnPath, req.nextUrl.origin))
  response.cookies.set(WORKSPACE_COOKIE_NAME, sealed, workspaceCookieOptions())
  return response
}
