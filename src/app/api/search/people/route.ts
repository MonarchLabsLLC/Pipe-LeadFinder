import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { resolveWorkspaceScope } from "@/lib/scale-workspace/guest"
import { ensureUser } from "@/lib/ensure-user"
import { assertSearchConfigured } from "@/services/search-service"
import { peopleSearchSchema } from "@/lib/validators/search"
import { guardCredits } from "@/lib/credit-guard"
import { validateSearchTarget } from "@/lib/search-target"
import { enqueueSearchJob } from "@/services/search-job"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const scope = await resolveWorkspaceScope(session, {
    method: "POST",
    path: "/api/search/people",
  })
  if (!scope.ok) {
    return scope.response
  }
  await ensureUser(session)

  // Credit pre-check
  const blocked = await guardCredits(scope.tenantUserId, scope.tenantEmail)
  if (blocked) return blocked

  const body = await req.json().catch(() => null)
  const parsed = peopleSearchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { listId, duplicatePolicy, ...searchParams } = parsed.data

  const invalidTarget = await validateSearchTarget(
    scope.tenantUserId,
    listId,
    "PEOPLE"
  )
  if (invalidTarget) return invalidTarget

  // Check if Apify actor is configured
  try {
    assertSearchConfigured("PEOPLE", searchParams)
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "People search is not configured",
        code: "ACTOR_NOT_CONFIGURED",
      },
      { status: 503 }
    )
  }

  try {
    const { search, job } = await enqueueSearchJob({
      userId: scope.tenantUserId,
      userEmail: scope.tenantEmail,
      searchType: "PEOPLE",
      listId,
      searchParams,
      duplicatePolicy,
      idempotencyKey: req.headers.get("idempotency-key"),
    })
    return NextResponse.json({
      jobId: job.id,
      searchId: search.id,
      listId,
      status: "QUEUED",
      statusUrl: `/api/jobs/${job.id}`,
    }, { status: 202 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to queue search" },
      { status: 500 }
    )
  }
}
