import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

// GET /api/leads/[id]/labels — return all labels applied to this lead's list entries
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: leadId } = await params

  const entryLabels = await prisma.leadEntryLabel.findMany({
    where: {
      entry: { leadId },
    },
    include: {
      label: true,
      entry: true,
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = entryLabels.map((el: any) => ({
    id: el.id,
    entryId: el.entryId,
    labelId: el.labelId,
    name: el.label.name,
    createdAt: el.createdAt,
  }))

  return NextResponse.json(result)
}

// POST /api/leads/[id]/labels — apply a label to a lead entry
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: leadId } = await params
  const body = await req.json()
  const { labelId, entryId } = body

  if (!labelId || !entryId) {
    return NextResponse.json(
      { error: "labelId and entryId are required" },
      { status: 400 }
    )
  }

  // Verify the label belongs to the current user
  const label = await prisma.customLabel.findUnique({
    where: { id: labelId },
  })

  if (!label || label.userId !== session.user.id) {
    return NextResponse.json({ error: "Label not found" }, { status: 404 })
  }

  // Verify the entry exists and belongs to this lead
  const entry = await prisma.leadListEntry.findUnique({
    where: { id: entryId },
  })

  if (!entry || entry.leadId !== leadId) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 })
  }

  // Check for duplicate
  const existing = await prisma.leadEntryLabel.findUnique({
    where: {
      entryId_labelId: {
        entryId,
        labelId,
      },
    },
  })

  if (existing) {
    return NextResponse.json(
      { error: "Label already applied to this entry" },
      { status: 409 }
    )
  }

  const entryLabel = await prisma.leadEntryLabel.create({
    data: {
      entryId,
      labelId,
    },
    include: {
      label: true,
    },
  })

  return NextResponse.json(
    {
      id: entryLabel.id,
      entryId: entryLabel.entryId,
      labelId: entryLabel.labelId,
      name: entryLabel.label.name,
      createdAt: entryLabel.createdAt,
    },
    { status: 201 }
  )
}
