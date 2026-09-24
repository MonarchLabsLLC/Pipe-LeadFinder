import { fetchOptions, prepareHandoff } from "@/lib/suite-link/handoff"

// GET /api/handoff/pipeleads/options - destinations the signed-in owner can pick in PipeLeads.
export async function GET() {
  const ready = await prepareHandoff("pipeleads", {
    method: "GET",
    path: "/api/handoff/pipeleads/options",
  })
  if (!ready.ok) return ready.response
  return fetchOptions(ready)
}
