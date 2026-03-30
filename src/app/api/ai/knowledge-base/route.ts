import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { getOrCreateProfile, updateProfile } from "@/services/knowledge-base-service"

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

  const body = await req.json()

  const allowedFields = [
    "businessName",
    "businessWebsite",
    "whatYouSell",
    "whoItHelps",
    "whatItDoes",
    "contactPerson",
    "personality",
  ] as const

  const data: Record<string, string> = {}
  for (const key of allowedFields) {
    if (key in body) {
      data[key] = body[key] ?? ""
    }
  }

  const profile = await updateProfile(session.user.id, data)
  return NextResponse.json(profile)
}
