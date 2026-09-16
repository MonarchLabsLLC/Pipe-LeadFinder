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
  const store = await cookies()
  const raw = store.get(WORKSPACE_COOKIE_NAME)?.value
  const sealed = raw ? await unsealWorkspaceSession(raw) : null
  const activeGuest = sealed && sealed.actorUserId === session.user.id ? sealed : null
  const fallback = !isScaleTeamWorkspacesEnabled() || !activeGuest
    ? PERSONAL
    : {
        workspaceType: "guest" as const,
        workspaceName: activeGuest.context.workspace.displayName,
        workspaceOwnerName: activeGuest.context.owner.displayName,
        workspaceOwnerEmail: activeGuest.context.owner.email,
        workspaceSwitchUrl: `${scaleWorkspaceHubUrl()}/team`,
        allowedApplications: activeGuest.allowedApplications.length
          ? activeGuest.allowedApplications
          : [SCALE_WORKSPACE_APP_SLUG],
      }

  return NextResponse.json(fallback)
}
