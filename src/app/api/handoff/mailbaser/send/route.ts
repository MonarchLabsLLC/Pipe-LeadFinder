import type { NextRequest } from "next/server"
import { prepareHandoff, sendHandoff } from "@/lib/suite-link/handoff"

// POST /api/handoff/mailbaser/send - send up to 50 owned leads to MailBaser.
export async function POST(request: NextRequest) {
  const ready = await prepareHandoff("mailbaser", {
    method: "POST",
    path: "/api/handoff/mailbaser/send",
  })
  if (!ready.ok) return ready.response
  return sendHandoff(ready, await request.json().catch(() => null))
}
