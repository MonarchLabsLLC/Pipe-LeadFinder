import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { updatePromptSchema } from "@/lib/validators/prompt"

// PATCH /api/ai/prompts/[id] — update a prompt template
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  // Verify ownership
  const existing = await prisma.promptTemplate.findUnique({
    where: { id },
  })

  if (!existing) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 })
  }

  if (existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const parsed = updatePromptSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const template = await prisma.promptTemplate.update({
    where: { id },
    data: parsed.data,
  })

  return NextResponse.json(template)
}

// DELETE /api/ai/prompts/[id] — delete a prompt template
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  // Verify ownership
  const existing = await prisma.promptTemplate.findUnique({
    where: { id },
  })

  if (!existing) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 })
  }

  if (existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await prisma.promptTemplate.delete({
    where: { id },
  })

  return NextResponse.json({ success: true })
}
