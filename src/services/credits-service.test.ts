import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn() } } }))

const { buildTokenConsumeBody, consumeTokenCredits } = await import("./credits-service")

const USER_UUID = "3f2a1c4e-1b2d-4c3e-8f9a-0b1c2d3e4f5a"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("AI token billing payload (ClickCampaigns TextUsagePayload shape)", () => {
  it("sends provider, model, real token counts, description and metadata", () => {
    const body = buildTokenConsumeBody({
      provider: "openrouter",
      model: "deepseek/deepseek-v4.1-flash",
      inputTokens: 1234,
      outputTokens: 567,
      description: "Lead Finder AI search interpretation",
      metadata: { feature: "search-interpret" },
      idempotencyKey: "idem-1",
    })
    expect(body).toEqual({
      provider: "openrouter",
      model: "deepseek/deepseek-v4.1-flash",
      inputTokens: 1234,
      outputTokens: 567,
      description: "Lead Finder AI search interpretation",
      metadata: {
        feature: "search-interpret",
        appName: "PipeLeads",
        inputTokens: 1234,
        outputTokens: 567,
      },
      appName: "PipeLeads",
      idempotencyKey: "idem-1",
    })
  })

  it("gives a default description and omits an absent idempotency key", () => {
    const body = buildTokenConsumeBody({
      provider: "openrouter",
      model: "deepseek/deepseek-v4-flash-0731",
      inputTokens: 10,
      outputTokens: 2,
    })
    expect(body.description).toBe("Lead Finder AI (deepseek/deepseek-v4-flash-0731)")
    expect(body).not.toHaveProperty("idempotencyKey")
  })

  it("POSTs that body to the micro service /credits/consume", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ success: true, debited: 3, availableCredits: 97 }), { status: 200 })
    )
    vi.stubGlobal("fetch", fetchMock)
    const result = await consumeTokenCredits(
      USER_UUID,
      {
        provider: "openrouter",
        model: "deepseek/deepseek-v4.1-flash",
        inputTokens: 100,
        outputTokens: 50,
        description: "Lead Finder AI assistant (SUMMARY)",
        metadata: { feature: "assistant" },
      },
      "me@x.co"
    )
    expect(result).toMatchObject({ success: true, debited: 3 })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toMatch(/\/credits\/consume$/)
    expect(init.method).toBe("POST")
    const body = JSON.parse(String(init.body))
    expect(body).toMatchObject({
      provider: "openrouter",
      model: "deepseek/deepseek-v4.1-flash",
      inputTokens: 100,
      outputTokens: 50,
      description: "Lead Finder AI assistant (SUMMARY)",
      appName: "PipeLeads",
    })
    expect((init.headers as Record<string, string>)["x-user-id"]).toBe(USER_UUID)
  })
})
