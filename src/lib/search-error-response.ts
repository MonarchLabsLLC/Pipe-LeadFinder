import { NextResponse } from "next/server"
import { SearchType } from "@/generated/prisma/enums"

type SearchErrorShape = {
  name?: unknown
  message?: unknown
  type?: unknown
  statusCode?: unknown
}

function getErrorShape(error: unknown): SearchErrorShape {
  return typeof error === "object" && error !== null
    ? (error as SearchErrorShape)
    : {}
}

function isApifyBillingBlocked(error: unknown) {
  const shape = getErrorShape(error)
  const message =
    typeof shape.message === "string" ? shape.message.toLowerCase() : ""

  return (
    shape.name === "ApifyApiError" &&
    (shape.type === "platform-feature-disabled" ||
      message.includes("outstanding invoice"))
  )
}

function getSearchErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Search failed"
}

export function searchErrorResponse(
  error: unknown,
  searchId: string,
  searchType: SearchType
) {
  if (isApifyBillingBlocked(error)) {
    const shape = getErrorShape(error)
    console.error("[Search] Apify billing blocked search execution", {
      searchId,
      searchType,
      provider: "apify",
      type: shape.type,
      statusCode: shape.statusCode,
      message: shape.message,
    })

    return NextResponse.json(
      {
        error:
          "Lead search is temporarily unavailable because the upstream data provider account is blocked by outstanding invoices. No credits were deducted.",
        code: "UPSTREAM_BILLING_BLOCKED",
        provider: "apify",
        searchId,
      },
      { status: 503 }
    )
  }

  const message = getSearchErrorMessage(error)

  console.error("[Search] Search execution failed", {
    searchId,
    searchType,
    message,
  })

  return NextResponse.json(
    { error: message, code: "SEARCH_FAILED", searchId },
    { status: 500 }
  )
}
