"use client"

import { useEffect, useState, type FormEvent } from "react"
import { ArrowRight, Loader2, Sparkles, TriangleAlert, Undo2 } from "lucide-react"
import type { SearchType } from "@/generated/prisma/enums"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SearchAssistError, useInterpretSearch } from "@/hooks/useSearchAssist"
import { DESCRIBE_EXAMPLES, SEARCH_GUIDE_BY_TYPE } from "@/components/search/search-guide"

const ROTATE_MS = 3_500

export interface SearchSuggestion {
  searchType: SearchType
  fields: Record<string, unknown>
  explanation: string
}

/**
 * "Describe who you want": one sentence in, the matching search pre-filled
 * out. It never runs a search — the user reviews the form first.
 */
export function DescribeSearch({ onSuggested }: { onSuggested: (suggestion: SearchSuggestion) => void }) {
  const [text, setText] = useState("")
  const [focused, setFocused] = useState(false)
  const [exampleIndex, setExampleIndex] = useState(0)
  const [notice, setNotice] = useState<{ message: string; purchaseUrl?: string } | null>(null)
  const interpret = useInterpretSearch()

  useEffect(() => {
    if (focused || text) return
    const id = window.setInterval(
      () => setExampleIndex((i) => (i + 1) % DESCRIBE_EXAMPLES.length),
      ROTATE_MS
    )
    return () => window.clearInterval(id)
  }, [focused, text])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const value = text.trim()
    if (value.length < 3 || interpret.isPending) return
    setNotice(null)
    try {
      const result = await interpret.mutateAsync(value)
      if (!result.ok) {
        setNotice({ message: result.message })
        return
      }
      onSuggested(result)
    } catch (error) {
      setNotice(
        error instanceof SearchAssistError
          ? { message: error.message, purchaseUrl: error.purchaseUrl }
          : { message: "The search assistant is unavailable right now. Pick a search below instead." }
      )
    }
  }

  const placeholder = `Try “${DESCRIBE_EXAMPLES[exampleIndex]}”`

  return (
    <section
      aria-labelledby="describe-search-title"
      className="rounded-xl border bg-card p-4 shadow-sm sm:p-5"
    >
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Sparkles className="size-4" aria-hidden />
        </span>
        <h2 id="describe-search-title" className="text-base font-semibold">
          Describe who you want
        </h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Say it in your own words. We&apos;ll pick the right search and fill it in — you check it before
        anything runs.
      </p>

      <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="describe-search-input" className="sr-only">
          Describe who you&apos;re looking for
        </label>
        <Input
          id="describe-search-input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          maxLength={500}
          autoComplete="off"
          disabled={interpret.isPending}
          className="h-11 flex-1 text-base md:text-base"
        />
        <Button
          type="submit"
          size="lg"
          className="h-11 sm:min-w-44"
          disabled={interpret.isPending || text.trim().length < 3}
        >
          {interpret.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Reading…
            </>
          ) : (
            <>
              Set up my search
              <ArrowRight className="size-4" aria-hidden />
            </>
          )}
        </Button>
      </form>

      <div aria-live="polite">
        {interpret.isPending ? (
          <p className="mt-2 text-xs text-muted-foreground">Matching your description to a search…</p>
        ) : notice ? (
          <p className="mt-2 flex items-start gap-1.5 text-sm text-foreground">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            <span>
              {notice.message}
              {notice.purchaseUrl ? (
                <>
                  {" "}
                  <a
                    href={notice.purchaseUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-primary underline-offset-2 hover:underline"
                  >
                    Open Credit Wallet
                  </a>
                </>
              ) : null}
            </span>
          </p>
        ) : null}
      </div>
    </section>
  )
}

/** "We picked Local search because …  Not right? Choose another search". */
export function SuggestionNote({
  suggestion,
  onChooseAnother,
}: {
  suggestion: SearchSuggestion
  onChooseAnother: () => void
}) {
  const guide = SEARCH_GUIDE_BY_TYPE[suggestion.searchType]
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <p className="flex items-start gap-2">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <span>
          We picked <span className="font-semibold">{guide.name}</span> because {suggestion.explanation}.
          Check the details below, then run it.
        </span>
      </p>
      <button
        type="button"
        onClick={onChooseAnother}
        className="inline-flex shrink-0 items-center gap-1 self-start pl-6 text-sm font-medium text-primary underline-offset-2 hover:underline sm:self-auto sm:pl-0"
      >
        <Undo2 className="size-3.5" aria-hidden />
        Not right? Choose another search
      </button>
    </div>
  )
}
