import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/auth"

// Rate limit: 1 request per second for Nominatim
const lastRequestByUser = new Map<string, number>()
const locationQuerySchema = z.object({
  query: z.string().trim().min(3).max(200),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsed = locationQuerySchema.safeParse(
    await req.json().catch(() => null)
  )
  if (!parsed.success) {
    return NextResponse.json([], { status: 400 })
  }
  const { query } = parsed.data

  const now = Date.now()
  const lastRequest = lastRequestByUser.get(session.user.id) ?? 0
  if (now - lastRequest < 1000) {
    return NextResponse.json({ message: "Rate limited. Please wait." }, { status: 429 })
  }
  lastRequestByUser.set(session.user.id, now)

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&addressdetails=1&limit=5&countrycodes=us`,
      {
        signal: AbortSignal.timeout(8_000),
        headers: {
          "User-Agent": "PipeLeadFinder/1.0 (contact@scale.gg)",
          "Accept-Language": "en-US,en;q=0.9",
        },
      }
    )
    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`)
    }

    const results = await response.json()
    return NextResponse.json(results)
  } catch (error) {
    console.error("Error searching locations:", error)
    return NextResponse.json({ message: "Failed to search locations" }, { status: 500 })
  }
}
