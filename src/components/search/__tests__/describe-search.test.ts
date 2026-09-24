import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/hooks/useSearchAssist", () => ({
  SearchAssistError: class extends Error {},
  useInterpretSearch: () => ({ isPending: false, mutateAsync: vi.fn() }),
}))

import { DescribeSearch } from "@/components/search/describe-search"

describe("DescribeSearch", () => {
  // The box is server-rendered and can take keystrokes before React hydrates.
  // A controlled input (value={state}) is reset to the empty state during
  // hydration and those keystrokes vanish, so the box must stay uncontrolled.
  it("server-renders the describe box without a controlled value", () => {
    const html = renderToString(createElement(DescribeSearch, { onSuggested: () => {} }))
    const input = html.match(/<input[^>]*id="describe-search-input"[^>]*>/)?.[0]
    expect(input).toBeDefined()
    expect(input).not.toMatch(/\svalue=/)
  })
})
