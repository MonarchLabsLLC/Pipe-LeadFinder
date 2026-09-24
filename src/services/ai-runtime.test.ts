import { afterEach, describe, expect, it, vi } from "vitest"
import {
  AiNotConfiguredError,
  OPENROUTER_TEXT_FALLBACK_MODELS,
  OPENROUTER_TEXT_MODEL,
  describeAiError,
  getAiLanguageModel,
  getAiRuntimeConfig,
  getOpenRouterApiKey,
  resolveBilledModel,
} from "./ai-runtime"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("AI runtime — OpenRouter model selection", () => {
  it("defaults every feature to OpenRouter DeepSeek V4.1 Flash with the 0731 fallback", () => {
    vi.stubEnv("LEADFINDER_AI_MODEL", "")
    for (const feature of ["assistant", "agent", "scoring", "search-interpret"] as const) {
      expect(getAiRuntimeConfig(feature)).toEqual({
        provider: "openrouter",
        model: "deepseek/deepseek-v4.1-flash",
        fallbackModels: ["deepseek/deepseek-v4-flash-0731"],
      })
    }
    expect(OPENROUTER_TEXT_MODEL).toBe("deepseek/deepseek-v4.1-flash")
    expect(OPENROUTER_TEXT_FALLBACK_MODELS).toEqual(["deepseek/deepseek-v4-flash-0731"])
  })

  it("lets LEADFINDER_AI_MODEL override the primary model", () => {
    vi.stubEnv("LEADFINDER_AI_MODEL", "  deepseek/deepseek-v4-flash-0731 ")
    const config = getAiRuntimeConfig("assistant")
    expect(config.model).toBe("deepseek/deepseek-v4-flash-0731")
    // The fallback never duplicates the primary.
    expect(config.fallbackModels).toEqual([])
  })

  it("reads OPEN_ROUTER_API_KEY first and OPENROUTER_API_KEY as a fallback", () => {
    vi.stubEnv("OPEN_ROUTER_API_KEY", "")
    vi.stubEnv("OPENROUTER_API_KEY", "")
    expect(getOpenRouterApiKey()).toBeUndefined()
    vi.stubEnv("OPENROUTER_API_KEY", "second")
    expect(getOpenRouterApiKey()).toBe("second")
    vi.stubEnv("OPEN_ROUTER_API_KEY", "first")
    expect(getOpenRouterApiKey()).toBe("first")
  })

  it("refuses to build a model without a key", () => {
    vi.stubEnv("OPEN_ROUTER_API_KEY", "")
    vi.stubEnv("OPENROUTER_API_KEY", "")
    expect(() => getAiLanguageModel(getAiRuntimeConfig("assistant"))).toThrow(AiNotConfiguredError)
  })

  it("builds an OpenRouter chat model for the configured id", () => {
    vi.stubEnv("OPEN_ROUTER_API_KEY", "test-key")
    vi.stubEnv("LEADFINDER_AI_MODEL", "")
    const model = getAiLanguageModel(getAiRuntimeConfig("scoring"))
    expect(model.modelId).toBe("deepseek/deepseek-v4.1-flash")
    expect(model.provider).toMatch(/openrouter/)
  })

  it("sends the fallback list, no reasoning, and ClickCampaigns-style attribution headers", async () => {
    vi.stubEnv("OPEN_ROUTER_API_KEY", "test-key")
    vi.stubEnv("LEADFINDER_AI_MODEL", "")
    vi.stubEnv("OPENROUTER_HTTP_REFERER", "https://leadfinder.example")
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          id: "gen-1",
          model: "deepseek/deepseek-v4-flash-0731",
          choices: [{ index: 0, message: { role: "assistant", content: "hi" }, finish_reason: "stop" }],
          usage: { prompt_tokens: 11, completion_tokens: 3, total_tokens: 14 },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    )
    vi.stubGlobal("fetch", fetchMock)
    try {
      const { generateText } = await import("ai")
      const config = getAiRuntimeConfig("assistant")
      const result = await generateText({ model: getAiLanguageModel(config), prompt: "hello" })
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
      expect(url).toBe("https://openrouter.ai/api/v1/chat/completions")
      const headers = new Headers(init.headers)
      expect(headers.get("authorization")).toBe("Bearer test-key")
      expect(headers.get("http-referer")).toBe("https://leadfinder.example")
      expect(headers.get("x-openrouter-title")).toBe("PipeLeads Lead Finder")
      const body = JSON.parse(String(init.body))
      expect(body.model).toBe("deepseek/deepseek-v4.1-flash")
      expect(body.models).toEqual(["deepseek/deepseek-v4.1-flash", "deepseek/deepseek-v4-flash-0731"])
      expect(body.reasoning).toEqual({ enabled: false, exclude: true })
      expect(body.provider).toEqual({ require_parameters: true, allow_fallbacks: true })
      // Billing follows the model that actually answered.
      expect(result.usage.inputTokens).toBe(11)
      expect(result.usage.outputTokens).toBe(3)
      expect(resolveBilledModel(config, result.response.modelId)).toBe(
        "deepseek/deepseek-v4-flash-0731"
      )
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe("resolveBilledModel", () => {
  const config = {
    provider: "openrouter" as const,
    model: "deepseek/deepseek-v4.1-flash",
    fallbackModels: ["deepseek/deepseek-v4-flash-0731"],
  }

  it("bills the model OpenRouter reports, including dated variants", () => {
    expect(resolveBilledModel(config, "deepseek/deepseek-v4.1-flash")).toBe("deepseek/deepseek-v4.1-flash")
    expect(resolveBilledModel(config, "deepseek/deepseek-v4-flash-0731")).toBe("deepseek/deepseek-v4-flash-0731")
    expect(resolveBilledModel(config, "deepseek/deepseek-v4.1-flash-20260901")).toBe(
      "deepseek/deepseek-v4.1-flash"
    )
  })

  it("falls back to the configured model for missing or unknown ids", () => {
    expect(resolveBilledModel(config, undefined)).toBe("deepseek/deepseek-v4.1-flash")
    expect(resolveBilledModel(config, "openai/gpt-5.4-nano")).toBe("deepseek/deepseek-v4.1-flash")
  })
})

describe("describeAiError", () => {
  it("never leaks keys or bearer tokens into logs", () => {
    const described = describeAiError(
      Object.assign(new Error("401 bad key sk-or-v1-abcdef1234567890 Bearer abc.def"), {
        name: "AI_APICallError",
        statusCode: 401,
      })
    )
    expect(described).toMatchObject({ provider: "openrouter", name: "AI_APICallError", statusCode: 401 })
    expect(String(described.message)).not.toContain("abcdef1234567890")
    expect(String(described.message)).not.toContain("abc.def")
  })
})
