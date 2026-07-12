import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { ensureUser } from "@/lib/ensure-user"
import { prisma } from "@/lib/prisma"
import {
  buildStorageKey,
  deleteFromSpaces,
  uploadToSpaces,
} from "@/lib/storage"
import { extractPdfText } from "@/lib/pdf-text"
import { getOrCreateProfile } from "@/services/knowledge-base-service"
import { DataSourceType } from "@/generated/prisma/enums"

export const runtime = "nodejs"

const MAX_PDF_SIZE = 50 * 1024 * 1024

function isPdf(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await ensureUser(session)
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 401 })
  }

  const formData = await req.formData().catch(() => null)
  if (!formData) {
    return NextResponse.json({ error: "Invalid multipart form" }, { status: 400 })
  }
  const fileValue = formData.get("file")
  const file = fileValue instanceof File ? fileValue : null

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  if (!isPdf(file)) {
    return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 })
  }

  if (file.size > MAX_PDF_SIZE) {
    return NextResponse.json(
      { error: `File too large. Maximum size is ${MAX_PDF_SIZE / 1024 / 1024}MB` },
      { status: 400 }
    )
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  if (buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
    return NextResponse.json({ error: "Invalid PDF file" }, { status: 400 })
  }

  let storageKey: string | null = null
  try {
    const { text, pageCount, truncated } = await extractPdfText(buffer)
    const profile = await getOrCreateProfile(user.id)
    const keycloakSubId = user.keycloakSubId || user.id
    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "document.pdf"
    const uniqueFilename = `${timestamp}-${safeName}`
    const key = buildStorageKey(keycloakSubId, "knowledge-base", uniqueFilename)
    storageKey = key
    const url = await uploadToSpaces(
      key,
      buffer,
      "application/pdf",
      "private"
    )

    const { fileRecord, source } = await prisma.$transaction(async (tx) => {
      const fileRecord = await tx.fileUpload.create({
        data: {
          userId: user.id,
          storageKey: key,
          filename: file.name,
          contentType: "application/pdf",
          size: file.size,
          folder: "knowledge-base",
          url,
        },
      })
      const source = await tx.dataSource.create({
        data: {
          profileId: profile.id,
          fileUploadId: fileRecord.id,
          type: DataSourceType.PDF,
          content: `PDF: ${file.name}\nPages: ${pageCount}\n${truncated ? "Text was truncated for prompt safety.\n" : ""}\n${text}`,
          name: file.name,
        },
      })
      return { fileRecord, source }
    })

    return NextResponse.json({ source, file: fileRecord }, { status: 201 })
  } catch (error) {
    if (storageKey) {
      await deleteFromSpaces(storageKey).catch((cleanupError) => {
        console.error("Failed to clean up PDF after upload error", cleanupError)
      })
    }
    const message = error instanceof Error ? error.message : "PDF upload failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
