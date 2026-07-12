import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { ensureUser } from "@/lib/ensure-user"
import { prisma } from "@/lib/prisma"
import {
  buildStorageKey,
  deleteFromSpaces,
  uploadToSpaces,
} from "@/lib/storage"

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await ensureUser(session)
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 401 })
  }

  // Use keycloakSubId for the DO Spaces directory; fall back to DB id in dev
  const keycloakSubId = user.keycloakSubId || user.id

  const formData = await req.formData().catch(() => null)
  if (!formData) {
    return NextResponse.json({ error: "Invalid multipart form" }, { status: 400 })
  }
  const fileValue = formData.get("file")
  const file = fileValue instanceof File ? fileValue : null
  const folder = (formData.get("folder") as string) || "general"

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  if (!/^[a-z0-9_-]{1,64}$/i.test(folder)) {
    return NextResponse.json({ error: "Invalid folder name" }, { status: 400 })
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
      { status: 400 },
    )
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty" }, { status: 400 })
  }
  if (file.name.length > 255) {
    return NextResponse.json({ error: "Filename is too long" }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  // Unique filename to avoid collisions
  const timestamp = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "file"
  const uniqueFilename = `${timestamp}-${safeName}`

  const storageKey = buildStorageKey(keycloakSubId, folder, uniqueFilename)
  let uploaded = false

  try {
    const contentType = file.type || "application/octet-stream"
    const url = await uploadToSpaces(storageKey, buffer, contentType)
    uploaded = true

    const fileRecord = await prisma.fileUpload.create({
      data: {
        userId: user.id,
        storageKey,
        filename: file.name,
        contentType,
        size: file.size,
        folder,
        url,
      },
    })

    return NextResponse.json(fileRecord, { status: 201 })
  } catch (error) {
    console.error("[Files] Upload failed:", error)
    if (uploaded) {
      await deleteFromSpaces(storageKey)
        .catch((cleanupError) =>
          console.error("[Files] Failed to roll back uploaded object:", cleanupError)
        )
    }
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
