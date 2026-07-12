import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { enqueueSearchJob } from "@/services/search-job"
import {
  companySearchSchema,
  domainSearchSchema,
  influencerSearchSchema,
  localSearchSchema,
  peopleSearchSchema,
} from "@/lib/validators/search"

const schemas = {
  PEOPLE: peopleSearchSchema,
  LOCAL: localSearchSchema,
  COMPANY: companySearchSchema,
  DOMAIN: domainSearchSchema,
  INFLUENCER: influencerSearchSchema,
} as const

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ searchId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchId } = await params
  const prior = await prisma.searchHistory.findFirst({
    where: { id: searchId, userId: session.user.id },
    include: { list: { select: { id: true, status: true } } },
  })
  if (!prior?.list || prior.list.status !== "ACTIVE") {
    return NextResponse.json({ error: "Search history was not found" }, { status: 404 })
  }

  const parsed = schemas[prior.searchType].safeParse(prior.parameters)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "This saved search is no longer valid", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { listId: _storedListId, duplicatePolicy, ...searchParams } = parsed.data
  void _storedListId
  const queued = await enqueueSearchJob({
    userId: session.user.id,
    userEmail: session.user.email,
    searchType: prior.searchType,
    listId: prior.list.id,
    searchParams,
    duplicatePolicy,
    idempotencyKey: request.headers.get("Idempotency-Key"),
  })

  return NextResponse.json(
    {
      jobId: queued.job.id,
      searchId: queued.search.id,
      listId: prior.list.id,
      status: "QUEUED",
      statusUrl: `/api/jobs/${queued.job.id}`,
    },
    { status: 202 }
  )
}
