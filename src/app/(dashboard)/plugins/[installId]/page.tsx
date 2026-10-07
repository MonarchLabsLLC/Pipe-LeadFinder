import { notFound } from "next/navigation"

import { PluginFrame } from "@/components/plugins/plugin-frame"
import { pluginsEnabled } from "@/server/plugins/env"

export const dynamic = "force-dynamic"

// One plugin, in a sandboxed cross-origin iframe. src/proxy.ts serves this page
// with the frame-src policy that names the plugin's origin.
export default async function Page({ params }: { params: Promise<{ installId: string }> }) {
  if (!pluginsEnabled()) notFound()
  const { installId } = await params
  return <PluginFrame installId={installId} />
}
