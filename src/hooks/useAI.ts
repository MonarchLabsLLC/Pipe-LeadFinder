"use client"

import { useState, useCallback, useRef } from "react"
import type { AiActionType } from "@/generated/prisma"

interface UseAIActionReturn {
  generate: (params: {
    leadId: string
    actionType: AiActionType
    customPrompt?: string
  }) => Promise<void>
  result: string
  isLoading: boolean
  error: string | null
  reset: () => void
}

export function useAIAction(): UseAIActionReturn {
  const [result, setResult] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const reset = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setResult("")
    setIsLoading(false)
    setError(null)
  }, [])

  const generate = useCallback(
    async (params: {
      leadId: string
      actionType: AiActionType
      customPrompt?: string
    }) => {
      // Reset state
      setResult("")
      setError(null)
      setIsLoading(true)

      // Abort any previous request
      if (abortRef.current) {
        abortRef.current.abort()
      }
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const response = await fetch("/api/ai/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
          signal: controller.signal,
        })

        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.error || `Request failed: ${response.status}`)
        }

        if (!response.body) {
          throw new Error("No response body")
        }

        // Read the stream — plain text stream from toTextStreamResponse()
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let accumulated = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          accumulated += chunk
          setResult(accumulated)
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return
        }
        const message = err instanceof Error ? err.message : "An error occurred"
        setError(message)
      } finally {
        setIsLoading(false)
        if (abortRef.current === controller) {
          abortRef.current = null
        }
      }
    },
    []
  )

  return { generate, result, isLoading, error, reset }
}
