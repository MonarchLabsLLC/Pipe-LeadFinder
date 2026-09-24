import { fetchOptions, prepareHandoff } from "@/lib/suite-link/handoff"

// GET /api/handoff/mailbaser/options - destinations the signed-in owner can pick in MailBaser.
export async function GET() {
  const ready = await prepareHandoff("mailbaser", {
    method: "GET",
    path: "/api/handoff/mailbaser/options",
  })
  if (!ready.ok) return ready.response
  return fetchOptions(ready)
}
