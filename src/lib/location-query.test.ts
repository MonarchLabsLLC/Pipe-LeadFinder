import { describe, expect, it } from "vitest"
import { nominatimSearchUrl } from "./location-query"

describe("nominatimSearchUrl", () => {
  it("does not restrict suggestions to the United States", () => {
    const url = nominatimSearchUrl("Singapore")
    expect(url).toContain("q=Singapore")
    expect(url).not.toContain("countrycodes")
  })
})
