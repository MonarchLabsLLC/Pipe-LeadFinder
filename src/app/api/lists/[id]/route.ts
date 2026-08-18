import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { resolveWorkspaceScope } from "@/lib/scale-workspace/guest"
import { prisma } from "@/lib/prisma"
import { updateListSchema } from "@/lib/validators/list"
import {
  buildLeadScorePromptTag,
  parseLeadScoreResult,
} from "@/lib/lead-score"

type RouteContext = { params: Promise<{ id: string }> }

const EMAIL_FILTERS = new Set(["FOUND", "NOT_FOUND", "POTENTIAL", "UNKNOWN"])

function positiveInteger(value: string | null, fallback: number, max: number) {
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) return fallback
  return Math.min(parsed, max)
}

// GET /api/lists/[id] — get list with paginated leads
export async function GET(req: NextRequest, context: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const scope = await resolveWorkspaceScope(session, {
    method: "GET",
    path: "/api/lists/[id]",
  })
  if (!scope.ok) {
    return scope.response
  }

  const { id } = await context.params
  const { searchParams } = req.nextUrl
  const page = positiveInteger(searchParams.get("page"), 1, 100_000)
  const limit = positiveInteger(searchParams.get("limit"), 25, 100)
  const emailFilter = searchParams.get("emailFilter")

  if (emailFilter && !EMAIL_FILTERS.has(emailFilter)) {
    return NextResponse.json({ error: "Invalid email filter" }, { status: 400 })
  }

  const list = await prisma.leadList.findUnique({
    where: { id },
  })

  if (!list) {
    return NextResponse.json({ error: "List not found" }, { status: 404 })
  }

  if (list.userId !== scope.tenantUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const leadWhere: Record<string, unknown> = { listId: id }
  if (emailFilter) {
    leadWhere.lead = { emailStatus: emailFilter }
  }

  const scorePromptTag = buildLeadScorePromptTag(id)

  const [entries, total, all, found, notFound, potential, unknown] = await Promise.all([
    prisma.leadListEntry.findMany({
      where: leadWhere,
      include: {
        lead: {
          include: {
            aiResults: {
              where: {
                actionType: "CUSTOM",
                prompt: scorePromptTag,
              },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
        labels: {
          include: { label: true },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.leadListEntry.count({ where: leadWhere }),
    prisma.leadListEntry.count({ where: { listId: id } }),
    prisma.leadListEntry.count({
      where: { listId: id, lead: { emailStatus: "FOUND" } },
    }),
    prisma.leadListEntry.count({
      where: { listId: id, lead: { emailStatus: "NOT_FOUND" } },
    }),
    prisma.leadListEntry.count({
      where: { listId: id, lead: { emailStatus: "POTENTIAL" } },
    }),
    prisma.leadListEntry.count({
      where: { listId: id, lead: { emailStatus: "UNKNOWN" } },
    }),
  ])

  return NextResponse.json({
    list: {
      id: list.id,
      name: list.name,
      type: list.type,
      status: list.status,
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    leads: entries.map((entry: any) => {
      const [latestScore] = entry.lead.aiResults
      const leadScore = parseLeadScoreResult(latestScore?.result)
      const { aiResults, rawData, ...lead } = entry.lead
      void aiResults
      void rawData

      return {
        entryId: entry.id,
        ...lead,
        leadScore: leadScore
          ? {
              ...leadScore,
              scoredAt: latestScore.createdAt,
              model: latestScore.model,
            }
          : null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        labels: entry.labels.map((l: any) => l.label),
      }
    }),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    counts: {
      ALL: all,
      FOUND: found,
      NOT_FOUND: notFound,
      POTENTIAL: potential,
      UNKNOWN: unknown,
    },
  })
}

// PATCH /api/lists/[id] — update list (rename, archive)
export async function PATCH(req: NextRequest, context: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const scope = await resolveWorkspaceScope(session, {
    method: "PATCH",
    path: "/api/lists/[id]",
  })
  if (!scope.ok) {
    return scope.response
  }

  const { id } = await context.params
  const list = await prisma.leadList.findUnique({ where: { id } })

  if (!list) {
    return NextResponse.json({ error: "List not found" }, { status: 404 })
  }
  if (list.userId !== scope.tenantUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = updateListSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const updated = await prisma.leadList.update({
    where: { id },
    data: parsed.data,
  })

  return NextResponse.json(updated)
}

// DELETE /api/lists/[id] — delete list (cascades entries)
export async function DELETE(_req: NextRequest, context: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const scope = await resolveWorkspaceScope(session, {
    method: "DELETE",
    path: "/api/lists/[id]",
  })
  if (!scope.ok) {
    return scope.response
  }

  const { id } = await context.params
  const list = await prisma.leadList.findUnique({ where: { id } })

  if (!list) {
    return NextResponse.json({ error: "List not found" }, { status: 404 })
  }
  if (list.userId !== scope.tenantUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const leadIds = await prisma.leadListEntry.findMany({
    where: { listId: id },
    select: { leadId: true },
  })
  await prisma.$transaction(async (tx) => {
    await tx.leadList.delete({ where: { id } })
    if (leadIds.length) {
      await tx.lead.deleteMany({
        where: {
          id: { in: leadIds.map((entry) => entry.leadId) },
          listEntries: { none: {} },
        },
      })
    }
  })

  return NextResponse.json({ success: true })
}
