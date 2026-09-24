import { describe, expect, it } from "vitest"
import { describeEmailStatus } from "./email-status"

describe("describeEmailStatus", () => {
  it("reads a found address as found but not verified", () => {
    const d = describeEmailStatus("FOUND", "a@b.com")
    expect(d.kind).toBe("found")
    expect(d.description).toBe("Found — not yet verified")
  })

  it("reads FOUND without an address as not found", () => {
    expect(describeEmailStatus("FOUND", null).kind).toBe("missing")
  })

  it("reads a potential address as guessed from the website", () => {
    const d = describeEmailStatus("POTENTIAL", "info@b.com")
    expect(d.kind).toBe("potential")
    expect(d.description).toBe("Potential — guessed from the company website")
  })

  it("reads unknown and not-found as not found", () => {
    expect(describeEmailStatus("UNKNOWN", null).description).toBe("Not found")
    expect(describeEmailStatus("NOT_FOUND", "x@y.com").kind).toBe("missing")
  })
})
