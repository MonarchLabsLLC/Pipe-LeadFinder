import { assertSameOrigin, getPluginFrame, pluginPageResponse } from "@/server/plugins/frame.service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// POST /api/plugins/installs/:installId/frame-pass: a fresh 60-second frame
// pass, fetched by this app's server and handed to the frame by postMessage.
export async function POST(request: Request, context: { params: Promise<{ installId: string }> }) {
  return pluginPageResponse(async () => {
    assertSameOrigin(request)
    return getPluginFrame((await context.params).installId)
  })
}
