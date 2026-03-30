import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { createPromptSchema } from "@/lib/validators/prompt"

// GET /api/ai/prompts — return all prompt templates for current user
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const templates = await prisma.promptTemplate.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(templates)
}

// POST /api/ai/prompts — create a new prompt template
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const parsed = createPromptSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const template = await prisma.promptTemplate.create({
    data: {
      name: parsed.data.name,
      prompt: parsed.data.prompt,
      userId: session.user.id,
    },
  })

  return NextResponse.json(template, { status: 201 })
}
