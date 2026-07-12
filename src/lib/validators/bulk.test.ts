import { describe, expect, it } from "vitest"
import { bulkActionSchema } from "./bulk"

describe("bulkActionSchema", () => {
  it("accepts a bounded selected-lead action", () => {
    expect(bulkActionSchema.safeParse({ entryIds: ["one"], action: "SCORE", options: {} }).success)
      .toBe(true)
  })

  it("rejects empty and oversized selections", () => {
    expect(bulkActionSchema.safeParse({ entryIds: [], action: "REMOVE", options: {} }).success)
      .toBe(false)
    expect(bulkActionSchema.safeParse({ entryIds: Array.from({ length: 101 }, (_, i) => String(i)), action: "REMOVE", options: {} }).success)
      .toBe(false)
  })
})
