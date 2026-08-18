/**
 * Sanitized workspace display context for launcher/client JavaScript.
 * Display only — these fields never authorize anything. Real authorization is
 * the per-request central authorize call in the proxy gate plus
 * resolveWorkspaceScope in the route handlers.
 */

import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { auth } from "@/auth"
import {
  isScaleTeamWorkspacesEnabled,
  scaleWorkspaceHubUrl,
} from "@/lib/scale-workspace/hub"
import { SCALE_WORKSPACE_APP_SLUG } from "@/lib/scale-workspace/contract"
import {
  WORKSPACE_COOKIE_NAME,
  unsealWorkspaceSession,
} from "@/lib/scale-workspace/session-cookie"

export const dynamic = "force-dynamic"

const PERSONAL = {
  workspaceType: "personal" as const,
  workspaceName: "Your workspace",
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!isScaleTeamWorkspacesEnabled()) {
    return NextResponse.json(PERSONAL)
  }
  const store = await cookies()
  const raw = store.get(WORKSPACE_COOKIE_NAME)?.value
  if (!raw) return NextResponse.json(PERSONAL)

  const sealed = await unsealWorkspaceSession(raw)
  if (!sealed || sealed.actorUserId !== session.user.id) {
    return NextResponse.json(PERSONAL)
  }

  return NextResponse.json({
    workspaceType: "guest" as const,
    workspaceName: sealed.context.workspace.displayName,
    workspaceOwnerName: sealed.context.owner.displayName,
    workspaceOwnerEmail: sealed.context.owner.email,
    workspaceSwitchUrl: `${scaleWorkspaceHubUrl()}/team`,
    allowedApplications: sealed.allowedApplications.length
      ? sealed.allowedApplications
      : [SCALE_WORKSPACE_APP_SLUG],
  })
}
