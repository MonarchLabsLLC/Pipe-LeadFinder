import { createHmac } from "node:crypto"
import { describe, expect, it } from "vitest"
import { buildSignedHeaders, signHandoff, verifySignedRequest } from "./signing"
import { contactsUrl, getHandoffStatus, getHandoffTarget, normalizeBaseUrl } from "./config"
import { bestEmail, nameParts, toMailbaserContact, toSuiteLead, type HandoffLeadRow } from "./payload"
import { chunk } from "@/components/handoff/handoff-client"

const SECRET = "s".repeat(40)
const REQUEST_ID = "7f1f3f0e-2b7a-4c55-9a0e-3f1d2c3b4a59"

describe("signing", () => {
  it("signs `${timestamp}.${requestId}.${rawBody}` as lowercase hex HMAC-SHA256", () => {
    const body = JSON.stringify({ subject: "kc-1", email: "a@b.co", requestId: REQUEST_ID })
    const expected = createHmac("sha256", SECRET)
      .update(`1700000000.${REQUEST_ID}.${body}`)
      .digest("hex")
    expect(signHandoff(SECRET, "1700000000", REQUEST_ID, body)).toBe(expected)
    expect(expected).toMatch(/^[a-f0-9]{64}$/)
  })

  it("builds the full header set with a unix-seconds timestamp", () => {
    const body = '{"requestId":"x"}'
    const headers = buildSignedHeaders(SECRET, body, { requestId: REQUEST_ID, now: 1_700_000_000_999 })
    expect(headers).toEqual({
      "content-type": "application/json",
      "x-scaleplus-app": "pipeleadsfinder",
      "x-scaleplus-timestamp": "1700000000",
      "x-scaleplus-request-id": REQUEST_ID,
      "x-scaleplus-signature": signHandoff(SECRET, "1700000000", REQUEST_ID, body),
    })
  })

  it("verifies round trips and rejects tampering, wrong secrets and stale timestamps", () => {
    const body = '{"a":1}'
    const now = 1_700_000_000_000
    const headers = buildSignedHeaders(SECRET, body, { requestId: REQUEST_ID, now })
    expect(verifySignedRequest(SECRET, headers, body, now)).toBe(true)
    expect(verifySignedRequest(SECRET, headers, '{"a":2}', now)).toBe(false)
    expect(verifySignedRequest("t".repeat(40), headers, body, now)).toBe(false)
    expect(verifySignedRequest(SECRET, headers, body, now + 301_000)).toBe(false)
    expect(verifySignedRequest(SECRET, { ...headers, "x-scaleplus-app": "other" }, body, now)).toBe(false)
    expect(
      verifySignedRequest(SECRET, { ...headers, "x-scaleplus-request-id": "other" }, body, now)
    ).toBe(false)
  })
})

describe("config", () => {
  it("enables a target only with a URL and a secret of at least 32 characters", () => {
    expect(getHandoffTarget("pipeleads", {})).toBeNull()
    expect(
      getHandoffTarget("pipeleads", { PIPELEADS_SUITE_URL: "https://go.pipeleads.ai", LEADFINDER_SUITE_SERVICE_SECRET: "short" })
    ).toBeNull()
    expect(getHandoffTarget("pipeleads", { LEADFINDER_SUITE_SERVICE_SECRET: SECRET })).toBeNull()
    expect(
      getHandoffTarget("mailbaser", { MAILBASER_URL: "https://mailbaser.com/", LEADFINDER_MAILBASER_SERVICE_SECRET: "x".repeat(32) })
    ).toMatchObject({ name: "mailbaser", baseUrl: "https://mailbaser.com" })
  })

  it("strips trailing slashes and rejects non-http URLs", () => {
    expect(normalizeBaseUrl("https://go.pipeleads.ai///")).toBe("https://go.pipeleads.ai")
    expect(normalizeBaseUrl("ftp://x")).toBeNull()
    expect(normalizeBaseUrl("not a url")).toBeNull()
    expect(normalizeBaseUrl("  ")).toBeNull()
  })

  it("reports flags and contact pages", () => {
    const env = { PIPELEADS_SUITE_URL: "https://go.pipeleads.ai", LEADFINDER_SUITE_SERVICE_SECRET: SECRET }
    expect(getHandoffStatus(env)).toEqual({ pipeleads: true, mailbaser: false })
    expect(contactsUrl(getHandoffTarget("pipeleads", env)!)).toBe("https://go.pipeleads.ai/crm/contacts")
    expect(
      contactsUrl(getHandoffTarget("mailbaser", { MAILBASER_URL: "https://mailbaser.com", LEADFINDER_MAILBASER_SERVICE_SECRET: SECRET })!)
    ).toBe("https://mailbaser.com/contacts")
  })
})

function row(overrides: Partial<HandoffLeadRow> = {}): HandoffLeadRow {
  return {
    id: "lead_1",
    firstName: null,
    lastName: null,
    fullName: null,
    title: null,
    headline: null,
    city: null,
    state: null,
    country: null,
    email: null,
    emailStatus: "UNKNOWN",
    phone: null,
    phoneStatus: "UNKNOWN",
    linkedinUrl: null,
    companyName: null,
    companyWebsite: null,
    companyIndustry: null,
    companySize: null,
    ...overrides,
  }
}

describe("payload", () => {
  it("maps a full lead and drops empty strings", () => {
    const lead = toSuiteLead(
      row({
        firstName: " Ada ",
        lastName: "Lovelace",
        title: "",
        headline: "Analyst",
        email: " Ada@Example.com ",
        emailStatus: "FOUND",
        phone: "+1 555 0100",
        phoneStatus: "FOUND",
        linkedinUrl: "https://linkedin.com/in/ada",
        city: "London",
        country: "",
        companyName: "Engines Ltd",
        companyWebsite: "engines.example",
        companyIndustry: "Computing",
        companySize: "11-50",
      }),
      "Q4 prospects"
    )
    expect(lead).toEqual({
      externalId: "lead_1",
      firstName: "Ada",
      lastName: "Lovelace",
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      phone: "+1 555 0100",
      title: "Analyst",
      linkedinUrl: "https://linkedin.com/in/ada",
      city: "London",
      companyName: "Engines Ltd",
      companyWebsite: "engines.example",
      companyIndustry: "Computing",
      companySize: "11-50",
      sourceListName: "Q4 prospects",
    })
    expect(Object.values(lead)).not.toContain("")
  })

  it("splits fullName when the parts are missing", () => {
    expect(nameParts(row({ fullName: "Grace Brewster Hopper" }))).toEqual({
      firstName: "Grace",
      lastName: "Brewster Hopper",
      fullName: "Grace Brewster Hopper",
    })
  })

  it("ignores emails marked NOT_FOUND or malformed", () => {
    expect(bestEmail({ email: "a@b.co", emailStatus: "NOT_FOUND" })).toBeUndefined()
    expect(bestEmail({ email: "not-an-email", emailStatus: "FOUND" })).toBeUndefined()
    expect(bestEmail({ email: "a@b.co", emailStatus: "POTENTIAL" })).toBe("a@b.co")
  })

  it("only builds a MailBaser contact when there is an email", () => {
    expect(toMailbaserContact(row())).toBeNull()
    expect(
      toMailbaserContact(row({ fullName: "Linus T", email: "l@t.io", companyName: "Kernel", title: "Maintainer" }))
    ).toEqual({ externalId: "lead_1", email: "l@t.io", firstName: "Linus", lastName: "T", company: "Kernel", title: "Maintainer" })
  })
})

describe("client batching", () => {
  it("splits selections into batches of 50", () => {
    const ids = Array.from({ length: 120 }, (_, index) => `l${index}`)
    expect(chunk(ids).map((batch) => batch.length)).toEqual([50, 50, 20])
    expect(chunk([])).toEqual([])
  })
})
