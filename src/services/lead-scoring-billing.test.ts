import { beforeEach, describe, expect, it, vi } from "vitest"

const generateText = vi.fn()
const consumeTokenCredits = vi.fn(async () => ({ success: true, debited: 1, availableCredits: 1 }))
vi.mock("ai", () => ({ generateText: (...args: unknown[]) => generateText(...args) }))
vi.mock("@/lib/prisma", () => ({ prisma: {} }))
vi.mock("@/services/ai-service", () => ({ getBusinessContext: vi.fn(async () => "context") }))
vi.mock("@/services/ai-runtime", () => ({
  getAiLanguageModel: vi.fn(() => ({})),
  getAiRuntimeConfig: vi.fn(() => ({ provider: "openrouter", model: "deepseek/deepseek-v4.1-flash" })),
  resolveBilledModel: vi.fn(() => "deepseek/deepseek-v4.1-flash"),
}))
vi.mock("@/services/credits-service", () => ({
  consumeTokenCredits: (...args: unknown[]) => consumeTokenCredits(...(args as [])),
}))

const { scoreLeadsForList } = await import("./lead-scoring-service")

const lead = { id: "lead-1", fullName: "Pat" } as never

describe("lead scoring billing", () => {
  beforeEach(() => {
    generateText.mockReset()
    consumeTokenCredits.mockClear()
  })

  it("charges usage before rejecting an unparseable answer", async () => {
    generateText.mockResolvedValue({ text: "not json", usage: { inputTokens: 900, outputTokens: 30 }, response: {} })
    await expect(
      scoreLeadsForList({ userId: "u1", listId: "l1", leads: [lead], idempotencyKey: "job:score:0" })
    ).rejects.toThrow()
    expect(consumeTokenCredits).toHaveBeenCalledTimes(1)
    const [, payload] = consumeTokenCredits.mock.calls[0] as unknown as [string, { inputTokens: number; idempotencyKey: string }]
    expect(payload.inputTokens).toBe(900)
    expect(payload.idempotencyKey).toMatch(/^job:score:0:/)
  })

  it("uses a fresh key for each provider call so retries are billed", async () => {
    generateText.mockResolvedValue({ text: "[]", usage: { inputTokens: 10, outputTokens: 5 }, response: {} })
    for (let i = 0; i < 2; i += 1) {
      await expect(
        scoreLeadsForList({ userId: "u1", listId: "l1", leads: [lead], idempotencyKey: "job:score:0" })
      ).rejects.toThrow(/unique results/)
    }
    const keys = consumeTokenCredits.mock.calls.map((c) => (c as unknown as [string, { idempotencyKey: string }])[1].idempotencyKey)
    expect(new Set(keys).size).toBe(2)
  })
})
