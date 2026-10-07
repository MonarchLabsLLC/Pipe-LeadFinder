import { z } from "zod"

import { PluginPageError, assertSameOrigin, decideForOwner, pluginPageResponse } from "@/server/plugins/frame.service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

const bodySchema = z.object({ decision: z.enum(["approve", "reject"]) }).strict()

// POST /api/plugins/proposals/:id/decision: the owner approves or rejects what
// a plugin asked for. Approving may spend the owner's Scale Credits.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return pluginPageResponse(async () => {
    assertSameOrigin(request)
    const body = bodySchema.safeParse(await request.json().catch(() => null))
    if (!body.success) throw new PluginPageError("Choose approve or reject.", 400)
    return decideForOwner((await context.params).id, body.data.decision)
  })
}
