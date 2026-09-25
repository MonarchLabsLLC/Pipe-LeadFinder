"use client"

import { useEffect, useState } from "react"
import { agentApi } from "@/components/agent/agent-api"
import { disclosureSummaryClass, nativeCheckboxClass } from "./styles"

/** Pick up to 50 saved leads in the selected list for enrichment or scoring. */
export function LeadSelector({
  listId,
  selected,
  onChange,
}: {
  listId: string
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [rows, setRows] = useState<
    {
      id: string
      name: string | null
      email: string | null
      company: string | null
    }[]
  >([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const abort = new AbortController()
    void agentApi<{ leads: typeof rows; nextCursor: string | null }>(
      `lists/${encodeURIComponent(listId)}`,
      undefined,
      abort.signal
    )
      .then((r) => {
        setRows(r.leads)
        setCursor(r.nextCursor)
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message)
      })
    return () => abort.abort()
  }, [listId])
  return (
    <details className="rounded-xl border bg-card p-3">
      <summary className={disclosureSummaryClass}>
        Selected saved leads ({selected.length}/50)
      </summary>
      <p className="mt-2 text-xs text-muted-foreground">
        Choose records for enrichment or scoring. Your approved preview always
        identifies the exact records.
      </p>
      <div className="max-h-44 overflow-y-auto">
        {rows.map((r) => (
          <label
            key={r.id}
            className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-2 text-sm hover:bg-muted/50"
          >
            <input
              type="checkbox"
              className={nativeCheckboxClass}
              checked={selected.includes(r.id)}
              disabled={!selected.includes(r.id) && selected.length >= 50}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...selected, r.id]
                    : selected.filter((id) => id !== r.id)
                )
              }
            />
            <span className="min-w-0 break-words">
              {r.name || "Unnamed lead"} ·{" "}
              {r.email || r.company || "Incomplete contact"}
            </span>
          </label>
        ))}
      </div>
      {cursor && (
        <button
          type="button"
          className="min-h-11 text-sm font-medium text-primary underline-offset-4 hover:underline disabled:opacity-50"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              const r = await agentApi<{
                leads: typeof rows
                nextCursor: string | null
              }>(
                `lists/${encodeURIComponent(listId)}?cursor=${encodeURIComponent(cursor)}`
              )
              setRows((v) => [...v, ...r.leads])
              setCursor(r.nextCursor)
            } catch (e) {
              setError((e as Error).message)
            } finally {
              setBusy(false)
            }
          }}
        >
          Load more leads
        </button>
      )}
      {!rows.length && !error && (
        <p className="py-2 text-xs text-muted-foreground">No saved leads in this list yet.</p>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </details>
  )
}
