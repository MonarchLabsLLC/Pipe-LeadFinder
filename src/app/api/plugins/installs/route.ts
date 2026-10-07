import { listPlugins, pluginPageResponse } from "@/server/plugins/frame.service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET /api/plugins/installs: the owner's installed plugins (from the ScalePlus
// dashboard) and what those plugins are waiting for the owner to approve.
export async function GET() {
  return pluginPageResponse(() => listPlugins())
}
