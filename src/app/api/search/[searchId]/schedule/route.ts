import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { agentScheduleSchema } from "@/lib/validators/agent"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ searchId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const schedule = agentScheduleSchema.safeParse(body?.schedule)
  if (!schedule.success || schedule.data === "manual") {
    return NextResponse.json({ error: "Choose a recurring schedule" }, { status: 400 })
  }

  const prior = await prisma.searchHistory.findFirst({
    where: { id: (await params).searchId, userId: session.user.id },
    include: { list: { select: { id: true, name: true, status: true } } },
  })
  if (!prior?.list || prior.list.status !== "ACTIVE") {
    return NextResponse.json({ error: "Search history was not found" }, { status: 404 })
  }

  const agent = await prisma.aiAgent.create({
    data: {
      userId: session.user.id,
      name: `${prior.list.name} recurring search`,
      description: "Created from search history",
      status: "ACTIVE",
      config: {
        searchType: prior.searchType,
        searchParams: prior.parameters,
        listId: prior.list.id,
        schedule: schedule.data,
        actions: [],
        connections: [],
      },
    },
  })

  return NextResponse.json({ agentId: agent.id, schedule: schedule.data }, { status: 201 })
}
