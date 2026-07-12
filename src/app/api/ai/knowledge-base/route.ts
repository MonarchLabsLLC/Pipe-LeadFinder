import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { getOrCreateProfile, updateProfile } from "@/services/knowledge-base-service"
import { businessProfileSchema } from "@/lib/validators/knowledge-base"

// GET /api/ai/knowledge-base — return business profile (create if missing)
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const profile = await getOrCreateProfile(session.user.id)
  return NextResponse.json(profile)
}

// PUT /api/ai/knowledge-base — update business profile fields
export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = businessProfileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid business profile", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const profile = await updateProfile(session.user.id, parsed.data)
  return NextResponse.json(profile)
}
