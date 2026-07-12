import { describe, expect, it } from "vitest"
import { normalizeLeadIdentities } from "./lead-identity"

describe("normalizeLeadIdentities", () => {
  it("normalizes stable person identities", () => {
    expect(normalizeLeadIdentities({
      email: "  MIKE@Example.COM ",
      linkedinUrl: "https://WWW.LinkedIn.com/in/Mike/?trk=test",
    }, "PEOPLE")).toEqual([
      { type: "EMAIL", value: "mike@example.com" },
      { type: "LINKEDIN", value: "linkedin.com/in/mike" },
    ])
  })

  it("uses a company domain only for company-like searches", () => {
    expect(normalizeLeadIdentities({ companyWebsite: "https://www.Example.com/about" }, "COMPANY"))
      .toContainEqual({ type: "COMPANY_DOMAIN", value: "example.com" })
    expect(normalizeLeadIdentities({ companyWebsite: "https://example.com" }, "PEOPLE"))
      .toEqual([])
  })

  it("normalizes social usernames", () => {
    expect(normalizeLeadIdentities({ platform: "YouTube", username: "@Creator" }, "INFLUENCER"))
      .toEqual([{ type: "SOCIAL_USERNAME", value: "youtube:creator" }])
  })
})
