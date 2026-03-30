import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { createLabelSchema } from "@/lib/validators/label"

// GET /api/labels — return all labels for current user
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const labels = await prisma.customLabel.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json(labels)
}

// POST /api/labels — create a new label
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const parsed = createLabelSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  // Check for duplicate name
  const existing = await prisma.customLabel.findUnique({
    where: {
      userId_name: {
        userId: session.user.id,
        name: parsed.data.name,
      },
    },
  })

  if (existing) {
    return NextResponse.json(
      { error: "A label with this name already exists" },
      { status: 409 }
    )
  }

  const label = await prisma.customLabel.create({
    data: {
      name: parsed.data.name,
      userId: session.user.id,
    },
  })

  return NextResponse.json(label, { status: 201 })
}
