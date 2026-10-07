import { randomUUID } from "node:crypto"

import { pluginsEnabled } from "@/server/plugins/env"
import { handlePluginRequest } from "@/server/plugins/service"
import { pluginServiceDeps } from "@/server/plugins/service.db"

// The Scale Plugin Store's way in (docs/Scale-Plugin-Channel.md). Only the
// ScalePlus dashboard calls this, with a signed service token; a plugin never
// talks to Lead Finder itself. With SCALE_PLUGINS_ENABLED off, or no usable
// secret, every path answers 404.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

async function handler(request: Request, context: { params: Promise<{ path: string[] }> }) {
  if (!pluginsEnabled()) return new Response("Not Found", { status: 404, headers: { "cache-control": "no-store" } })
  const segments = (await context.params).path
  // The exact bytes that were signed: read once, as text, before anything parses them.
  const rawBody = request.method === "GET" ? "" : await request.text()
  return handlePluginRequest({ request, rawBody, segments, requestId: randomUUID() }, pluginServiceDeps)
}

export { handler as GET, handler as POST }
