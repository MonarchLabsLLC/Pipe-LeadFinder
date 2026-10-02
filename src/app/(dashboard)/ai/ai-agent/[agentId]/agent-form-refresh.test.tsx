/**
 * @vitest-environment happy-dom
 *
 * Saving an agent updates its timestamp. The builder used that timestamp as a
 * React key, so every save remounted the form and discarded in-progress text.
 */
import { createRoot, type Root } from "react-dom/client"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
import { act } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  agent: {
    id: "agent-1",
    name: "Ada",
    description: null as string | null,
    status: "DRAFT" as const,
    config: null as Record<string, unknown> | null,
    autoSave: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
}))

vi.mock("next/navigation", () => ({
  useParams: () => ({ agentId: "agent-1" }),
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock("@/hooks/useAgents", () => ({
  useAgent: () => ({
    data: state.agent,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useUpdateAgent: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useRunAgent: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

import AgentBuilderPage from "./page"

describe("agent builder form", () => {
  let root: Root | undefined
  let container: HTMLDivElement | undefined

  afterEach(() => {
    act(() => root?.unmount())
    container?.remove()
    root = undefined
    container = undefined
    state.agent = {
      ...state.agent,
      name: "Ada",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }
  })

  it("keeps unsaved text when a save refreshes the agent timestamp", () => {
    container = document.createElement("div")
    document.body.appendChild(container)
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    root = createRoot(container)
    const renderPage = () => {
      act(() => {
        root!.render(
          <QueryClientProvider client={client}>
            <AgentBuilderPage />
          </QueryClientProvider>
        )
      })
    }

    renderPage()
    const input = container.querySelector<HTMLInputElement>("#agent-name")!
    expect(input.value).toBe("Ada")

    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set
      setValue?.call(input, "Ada Lovelace")
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    expect(input.value).toBe("Ada Lovelace")

    state.agent = { ...state.agent, updatedAt: "2026-01-01T00:00:01.000Z" }
    renderPage()

    expect(container.querySelector<HTMLInputElement>("#agent-name")!.value).toBe(
      "Ada Lovelace"
    )
  })
})
