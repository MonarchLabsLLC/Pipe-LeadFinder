import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { denyUnapprovedOwnerUsage, resolveWorkspaceScope } from "@/lib/scale-workspace/guest"
import { ensureUser } from "@/lib/ensure-user"
import { guardCredits } from "@/lib/credit-guard"
import { interpretRequestSchema, interpretSearch } from "@/services/search-interpret-service"

/**
 * POST /api/search/interpret — "Describe who you want".
 * Turns a sentence into a search type and pre-filled form fields. It only
 * proposes a search: nothing runs until the user reviews and submits the form.
 * Access and billing follow the search routes (tenant-scoped, owner-billed
 * work gated for guests, credit guard first, token usage charged).
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const scope = await resolveWorkspaceScope(session, {
    method: "POST",
    path: "/api/search/interpret",
  })
  if (!scope.ok) return scope.response
  const ownerUsageDenied = denyUnapprovedOwnerUsage(scope)
  if (ownerUsageDenied) return ownerUsageDenied
  await ensureUser(session)
  const blocked = await guardCredits(scope.tenantUserId, scope.tenantEmail)
  if (blocked) return blocked

  const parsed = interpretRequestSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Describe who you're looking for" },
      { status: 400 }
    )
  }

  try {
    const result = await interpretSearch({
      text: parsed.data.text,
      userId: scope.tenantUserId,
      email: scope.tenantEmail,
      idempotencyKey: req.headers.get("idempotency-key") ?? undefined,
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error("[SearchInterpret] Failed:", (error as Error).message)
    return NextResponse.json(
      { error: "The search assistant is unavailable right now. Pick a search below instead." },
      { status: 503 }
    )
  }
}
