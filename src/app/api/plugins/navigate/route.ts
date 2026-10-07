import { pluginPageResponse, resolvePluginNavigation } from "@/server/plugins/frame.service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET /api/plugins/navigate?resource=list&id=…: where a plugin frame's
// `scale.frame.navigate` goes. Only the owner's own saved lists; else null.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  return pluginPageResponse(() => resolvePluginNavigation((params.get("resource") ?? "").slice(0, 40), (params.get("id") ?? "").slice(0, 200)))
}
