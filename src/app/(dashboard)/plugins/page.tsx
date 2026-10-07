import { notFound } from "next/navigation"

import { PluginsPage } from "@/components/plugins/plugins-page"
import { pluginsEnabled } from "@/server/plugins/env"

export const dynamic = "force-dynamic"

// The Scale Plugin Store's page in Lead Finder. Off (404) unless
// SCALE_PLUGINS_ENABLED=true; the list itself is owner-only (the API checks).
export default function Page() {
  if (!pluginsEnabled()) notFound()
  return <PluginsPage />
}
