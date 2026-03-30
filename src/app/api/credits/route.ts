import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { getBalance, ensureCreditsAvailable } from "@/services/credits-service"

/**
 * GET /api/credits — get current user's credit balance
 * Frontend polls this endpoint via CreditsContext.
 */
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const action = searchParams.get("action")

  // ?action=check → pre-operation availability check
  if (action === "check") {
    const result = await ensureCreditsAvailable(
      session.user.id,
      session.user.email
    )
    if (!result.ok) {
      return NextResponse.json(
        {
          canProceed: false,
          balance: result.balance?.availableCredits ?? 0,
          message: result.message,
          purchaseUrl:
            process.env.SCALECREDITS_URL || "https://credits.scaleplus.gg",
        },
        { status: result.status || 402 }
      )
    }
    return NextResponse.json({
      canProceed: true,
      balance: result.balance?.availableCredits ?? 0,
    })
  }

  // Default: return balance
  const balance = await getBalance(session.user.id, session.user.email)
  if (!balance) {
    // Service unavailable — return a safe default so UI doesn't break
    return NextResponse.json({
      userId: session.user.id,
      availableCredits: 0,
      consumedCredits: 0,
      updatedAt: null,
    })
  }

  return NextResponse.json(balance)
}
