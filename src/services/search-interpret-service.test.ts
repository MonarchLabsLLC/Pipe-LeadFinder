import { describe, expect, it, vi } from "vitest"

vi.mock("@/services/credits-service", () => ({ consumeTokenCredits: vi.fn() }))

import type { InterpretDeps, InterpretModelOutput } from "./search-interpret-service"

const { interpretSearch, sanitizeInterpretedFields, UNCLEAR_MESSAGE } = await import(
  "./search-interpret-service"
)

function deps(output: InterpretModelOutput, usage = { inputTokens: 120, outputTokens: 40 }) {
  const bill = vi.fn(async () => ({ success: true, debited: 1, availableCredits: 99 }))
  const generate = vi.fn(async () => ({ output, usage }))
  return { deps: { generate, bill } as unknown as InterpretDeps, bill, generate }
}

const input = { text: "dentists in Tampa", userId: "user_1", email: "me@x.co", idempotencyKey: "idem-1" }

describe("interpretSearch — maps a description to each search type", () => {
  const cases: [string, InterpretModelOutput, Record<string, unknown>][] = [
    [
      "LOCAL",
      {
        searchType: "LOCAL",
        explanation: "you described businesses in a place",
        fields: [
          { name: "businessType", value: "Dentist" },
          { name: "location", value: "Tampa, FL" },
        ],
      },
      { businessType: "Dentist", location: "Tampa, FL" },
    ],
    [
      "PEOPLE",
      {
        searchType: "PEOPLE",
        explanation: "you described people by their job",
        fields: [
          { name: "description", value: "Marketing Director" },
          { name: "industry", value: "SaaS" },
          { name: "location", value: "Texas" },
          { name: "managementLevel", value: "Director" },
        ],
      },
      { description: "Marketing Director", industry: "SaaS", location: "Texas", managementLevel: "director" },
    ],
    [
      "COMPANY",
      {
        searchType: "COMPANY",
        explanation: "you described a kind of company",
        fields: [
          { name: "description", value: "Marketing agency" },
          { name: "employeeCount", value: "11-50" },
        ],
      },
      { description: "Marketing agency", employeeCount: "11-50" },
    ],
    [
      "DOMAIN",
      {
        searchType: "DOMAIN",
        explanation: "you named one company",
        fields: [{ name: "companyNameOrWebsite", value: "acme.com" }],
      },
      { companyNameOrWebsite: "acme.com" },
    ],
    [
      "INFLUENCER",
      {
        searchType: "INFLUENCER",
        explanation: "you described social media creators",
        fields: [
          { name: "platform", value: "Instagram" },
          { name: "description", value: "fitness creators" },
          { name: "followersFrom", value: "10k" },
          { name: "followersTo", value: "100,000" },
          { name: "hashtags", value: "#fitness, #gym" },
          { name: "verified", value: "true" },
        ],
      },
      {
        platform: "instagram",
        description: "fitness creators",
        followersFrom: 10000,
        followersTo: 100000,
        hashtags: ["fitness", "gym"],
        verified: true,
      },
    ],
  ]

  for (const [type, output, expected] of cases) {
    it(type, async () => {
      const { deps: d } = deps(output)
      const result = await interpretSearch(input, d)
      expect(result).toMatchObject({ ok: true, searchType: type, fields: expected })
    })
  }
})

describe("sanitizeInterpretedFields — never trusts the model", () => {
  it("drops unknown fields, list targeting and invalid values", () => {
    const { fields, dropped } = sanitizeInterpretedFields("LOCAL", [
      { name: "businessType", value: "Gym" },
      { name: "location", value: "Austin, TX" },
      { name: "listId", value: "someone_elses_list" },
      { name: "duplicatePolicy", value: "RETURN_ALL" },
      { name: "companySize", value: "11-50" },
      { name: "__proto__", value: "x" },
    ])
    expect(fields).toEqual({ businessType: "Gym", location: "Austin, TX" })
    expect(dropped).toEqual(expect.arrayContaining(["listId", "duplicatePolicy", "companySize", "__proto__"]))
  })

  it("drops enum values the schema does not allow and over-long text", () => {
    const { fields, dropped } = sanitizeInterpretedFields("PEOPLE", [
      { name: "description", value: "Founder" },
      { name: "managementLevel", value: "emperor" },
      { name: "employeeCount", value: "lots" },
      { name: "school", value: "x".repeat(500) },
    ])
    expect(fields).toEqual({ description: "Founder" })
    expect(dropped).toEqual(expect.arrayContaining(["managementLevel", "employeeCount", "school"]))
  })

  it("snaps the results limit to an option the form offers", () => {
    expect(sanitizeInterpretedFields("LOCAL", [{ name: "resultsLimit", value: "20" }]).fields).toEqual({
      resultsLimit: 25,
    })
    expect(sanitizeInterpretedFields("PEOPLE", [{ name: "resultsLimit", value: "1000" }]).fields).toEqual({
      resultsLimit: 100,
    })
    expect(sanitizeInterpretedFields("DOMAIN", [{ name: "resultsLimit", value: "many" }]).dropped).toEqual([
      "resultsLimit",
    ])
  })

  it("drops a follower range that is back to front", () => {
    const { fields } = sanitizeInterpretedFields("INFLUENCER", [
      { name: "description", value: "chefs" },
      { name: "followersFrom", value: "50000" },
      { name: "followersTo", value: "1000" },
    ])
    expect(fields).toEqual({ description: "chefs" })
  })
})

describe("interpretSearch — unusable input and billing", () => {
  it("returns a friendly message when the model is unsure", async () => {
    const { deps: d } = deps({ searchType: "UNCLEAR", explanation: "", fields: [] })
    await expect(interpretSearch({ ...input, text: "asdf qwer" }, d)).resolves.toEqual({
      ok: false,
      reason: "unclear",
      message: UNCLEAR_MESSAGE,
    })
  })

  it("treats a type with no valid fields as unusable", async () => {
    const { deps: d } = deps({
      searchType: "LOCAL",
      explanation: "you described businesses",
      fields: [{ name: "listId", value: "x" }, { name: "resultsLimit", value: "10" }],
    })
    const result = await interpretSearch(input, d)
    expect(result.ok).toBe(false)
  })

  it("bills the tenant for the tokens used, with the request's idempotency key", async () => {
    const { deps: d, bill } = deps({
      searchType: "DOMAIN",
      explanation: "you named one company",
      fields: [{ name: "companyNameOrWebsite", value: "acme.com" }],
    })
    await interpretSearch(input, d)
    expect(bill).toHaveBeenCalledTimes(1)
    expect(bill).toHaveBeenCalledWith(
      "user_1",
      expect.objectContaining({
        provider: "openai",
        model: "gpt-5.4-nano",
        inputTokens: 120,
        outputTokens: 40,
        idempotencyKey: "idem-1",
      }),
      "me@x.co"
    )
  })

  it("still bills when the answer is unusable, and skips billing without usage", async () => {
    const unclear = deps({ searchType: "UNCLEAR", explanation: "", fields: [] })
    await interpretSearch(input, unclear.deps)
    expect(unclear.bill).toHaveBeenCalledTimes(1)

    const noUsage = deps(
      { searchType: "UNCLEAR", explanation: "", fields: [] },
      { inputTokens: 0, outputTokens: 0 }
    )
    await interpretSearch(input, noUsage.deps)
    expect(noUsage.bill).not.toHaveBeenCalled()
  })

  it("replaces a missing or runaway explanation with a plain reason", async () => {
    const { deps: d } = deps({
      searchType: "LOCAL",
      explanation: "x".repeat(400),
      fields: [{ name: "businessType", value: "Dentist" }],
    })
    const result = await interpretSearch(input, d)
    expect(result).toMatchObject({ ok: true, explanation: "you described businesses in a place" })
  })
})
