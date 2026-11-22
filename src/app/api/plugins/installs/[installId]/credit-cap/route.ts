import { z } from "zod"

import { PluginPageError, assertSameOrigin, pluginPageResponse, setCapForOwner } from "@/server/plugins/frame.service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodySchema = z.object({ monthlyCredits: z.number().int().nullable() }).strict()

// PUT /api/plugins/installs/:installId/credit-cap: the owner sets the monthly
// Scale Credits cap for one plugin's unattended work, or removes it (null).
// Without a cap, every paid action the plugin asks for waits for approval.
export async function PUT(request: Request, context: { params: Promise<{ installId: string }> }) {
  return pluginPageResponse(async () => {
    assertSameOrigin(request)
    const body = bodySchema.safeParse(await request.json().catch(() => null))
    if (!body.success) throw new PluginPageError("Send a whole number of credits, or null to remove the cap.", 400)
    return setCapForOwner((await context.params).installId, body.data.monthlyCredits)
  })
}
