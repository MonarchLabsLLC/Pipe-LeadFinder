import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { getPipeLeadsPricing } from "@/services/credits-service"
import {
  CREDIT_COSTS,
  DISPLAY_CREDITS_PER_USD,
  PIPELEADS_PRICING_MODELS,
} from "@/lib/pipeleads-credit-pricing"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const pricing = await getPipeLeadsPricing()
  if (pricing) {
    return NextResponse.json({ items: pricing })
  }

  return NextResponse.json({
    items: Object.entries(CREDIT_COSTS).map(([action, creditsPerHit]) => ({
      action,
      model: PIPELEADS_PRICING_MODELS[action as keyof typeof CREDIT_COSTS],
      label: action,
      unit: "hit",
      usdPerHit: creditsPerHit / DISPLAY_CREDITS_PER_USD,
      multiplier: 1,
      creditsPerHit,
      configured: false,
      updatedAt: null,
    })),
  })
}
