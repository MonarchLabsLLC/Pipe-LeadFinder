import { PDFParse } from "pdf-parse"

const MAX_PDF_TEXT_CHARS = 200_000

export async function extractPdfText(buffer: Buffer) {
  const parser = new PDFParse({ data: buffer })

  try {
    const result = await parser.getText()
    const normalized = result.text
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()

    if (!normalized) {
      throw new Error("No readable text was found in this PDF.")
    }

    const truncated = normalized.length > MAX_PDF_TEXT_CHARS
    const text = truncated
      ? `${normalized.slice(0, MAX_PDF_TEXT_CHARS)}\n\n[PDF text truncated after ${MAX_PDF_TEXT_CHARS.toLocaleString()} characters.]`
      : normalized

    return {
      text,
      pageCount: result.total,
      truncated,
    }
  } finally {
    await parser.destroy()
  }
}
