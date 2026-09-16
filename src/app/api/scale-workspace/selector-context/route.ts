import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { auth } from "@/auth"
import { isScaleTeamWorkspacesEnabled, scaleWorkspaceHubUrl } from "@/lib/scale-workspace/hub"
import { WORKSPACE_COOKIE_NAME, unsealWorkspaceSession } from "@/lib/scale-workspace/session-cookie"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const session = await auth()
  const bearer = request.headers.get("authorization")
  if (!session?.user?.id || !isScaleTeamWorkspacesEnabled() || !bearer?.toLowerCase().startsWith("bearer ")) return NextResponse.json({})
  const raw = (await cookies()).get(WORKSPACE_COOKIE_NAME)?.value
  const sealed = raw ? await unsealWorkspaceSession(raw) : null
  const currentWorkspaceId = sealed?.actorUserId === session.user.id ? sealed.context.workspace.id : undefined
  const rawReturnPath = request.nextUrl.searchParams.get("returnPath") || ""
  const returnPath = rawReturnPath.startsWith("/") && !rawReturnPath.startsWith("//") && !rawReturnPath.includes("\\") && !/[\r\n]/.test(rawReturnPath) ? rawReturnPath : "/"
  try {
    const response = await fetch(`${scaleWorkspaceHubUrl()}/api/workspaces/v1/selector`, { method: "POST", headers: { "Content-Type": "application/json", "X-Scale-Workspace-Client": process.env.SCALE_WORKSPACE_CLIENT_ID || "", "X-Scale-Workspace-Secret": process.env.SCALE_WORKSPACE_CLIENT_SECRET || "", Authorization: bearer }, body: JSON.stringify({ returnPath, currentWorkspaceId }), signal: AbortSignal.timeout(5_000) })
    if (!response.ok) return NextResponse.json({})
    const payload = await response.json()
    if (!Array.isArray(payload?.workspaces) || typeof payload?.currentWorkspaceId !== "string") return NextResponse.json({})
    return NextResponse.json({ workspaceContext: { activeWorkspaceId: payload.currentWorkspaceId, manageUrl: `${scaleWorkspaceHubUrl()}${typeof payload.managePath === "string" ? payload.managePath : "/team"}`, workspaces: payload.workspaces.filter((workspace: any) => workspace && typeof workspace.id === "string" && typeof workspace.name === "string" && (workspace.kind === "personal" || workspace.kind === "shared") && (workspace.role === "owner" || workspace.role === "member") && typeof workspace.switchPath === "string" && workspace.switchPath.startsWith("/api/workspaces/switch?intent=")).map((workspace: any) => ({ id: workspace.id, name: workspace.name, type: workspace.kind === "shared" ? "guest" : "personal", role: workspace.role, ownerName: typeof workspace.ownerName === "string" ? workspace.ownerName : undefined, switchUrl: `${scaleWorkspaceHubUrl()}${workspace.switchPath}` })) } })
  } catch { return NextResponse.json({}) }
}
