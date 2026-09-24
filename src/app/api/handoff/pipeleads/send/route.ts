import type { NextRequest } from "next/server"
import { prepareHandoff, sendHandoff } from "@/lib/suite-link/handoff"

// POST /api/handoff/pipeleads/send - send up to 50 owned leads to PipeLeads.
export async function POST(request: NextRequest) {
  const ready = await prepareHandoff("pipeleads", {
    method: "POST",
    path: "/api/handoff/pipeleads/send",
  })
  if (!ready.ok) return ready.response
  return sendHandoff(ready, await request.json().catch(() => null))
}
