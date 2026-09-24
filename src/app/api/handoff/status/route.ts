import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { getHandoffStatus } from "@/lib/suite-link/config"

// GET /api/handoff/status - which one-click targets are configured (flags only).
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return NextResponse.json(getHandoffStatus(), {
    headers: { "cache-control": "no-store" },
  })
}
