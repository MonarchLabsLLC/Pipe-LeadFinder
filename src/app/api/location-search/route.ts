import { NextRequest, NextResponse } from "next/server"

// Rate limit: 1 request per second for Nominatim
let lastNominatimRequest = 0

export async function POST(req: NextRequest) {
  const { query } = await req.json()

  if (!query || query.length < 3) {
    return NextResponse.json([])
  }

  const now = Date.now()
  if (now - lastNominatimRequest < 1000) {
    return NextResponse.json({ message: "Rate limited. Please wait." }, { status: 429 })
  }
  lastNominatimRequest = now

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5&countrycodes=us`,
      {
        headers: {
          "User-Agent": "PipeLeadFinder/1.0 (contact@scale.gg)",
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
