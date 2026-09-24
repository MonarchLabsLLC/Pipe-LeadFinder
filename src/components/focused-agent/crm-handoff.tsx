"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { codeBlockClass, disclosureSummaryClass, nativeCheckboxClass, nativeSelectClass } from "./styles"

type Destinations = { workspaces: { id: string; name: string }[]; workspaceId: string | null;
  pipelines: { resources: { id: string; name: string; stages: { id: string; name: string }[] }[]; hasMore: boolean } | null }
type Proposal = { id: string; status: string; preview: unknown; approvalUrl: string; result: { records?: { contact?: {url:string;name:string}; deal?: {url:string;name:string} }[] } | null }
type History = { id: string; metadata: { proposalId: string; listId: string; approvalUrl: string }; createdAt: string }[]
async function request<T>(action: string, input?: unknown): Promise<T> {
  const response = await fetch(`/api/focused-agent/handoff/${action}`, { method: input === undefined ? "GET" : "POST", credentials: "same-origin", cache: "no-store",
    headers: input === undefined ? {} : { "Content-Type": "application/json", "X-Focused-Agent-Action": "1" },
    body: input === undefined ? undefined : JSON.stringify({ requestId: crypto.randomUUID(), input }) })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error?.message || "CRM transfer is unavailable.")
  return result.data
}
export function CrmHandoff({ listId, leadIds }: { listId: string; leadIds: string[] }) {
  const [destinations, setDestinations] = useState<Destinations | null>(null)
  const [pipeline, setPipeline] = useState("")
  const [stage, setStage] = useState("")
  const [createDeals, setCreateDeals] = useState(true)
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [history, setHistory] = useState<History>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => { let active = true; request<History>("history").then(rows => { if (active) setHistory(rows) }).catch(() => {}); return () => { active = false } }, [])
  async function run(fn: () => Promise<void>) { setBusy(true); setError(""); try { await fn() } catch (e) { setError(e instanceof Error ? e.message : "Transfer failed.") } finally { setBusy(false) } }
  const selectStyle = cn(nativeSelectClass, "mt-1.5")
  return <details className="min-w-0 space-y-3 rounded-xl border bg-card p-3">
    <summary className={disclosureSummaryClass}>Send selected leads to CRM</summary>
    <p className="text-xs text-muted-foreground">Preview {leadIds.length} selected records. Existing matches are skipped, never overwritten. Approval happens in CRM.</p>
    <Button size="sm" variant="outline" disabled={busy} onClick={() => run(async () => { setDestinations(await request("destinations", {})); setPipeline(""); setStage("") })}>Choose destination</Button>
    {destinations && <>
      <label className="block text-xs font-medium">CRM workspace<select aria-label="CRM workspace" className={selectStyle} value={destinations.workspaceId || ""} disabled={busy} onChange={e => run(async () => { setDestinations(await request("destinations", { destinationWorkspaceId: e.target.value })); setPipeline(""); setStage("") })}>
        <option value="">Choose workspace</option>{destinations.workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select></label>
      <label className="block text-xs font-medium">Pipeline<select aria-label="CRM pipeline" className={selectStyle} value={pipeline} onChange={e => { setPipeline(e.target.value); setStage("") }}><option value="">Choose pipeline</option>{destinations.pipelines?.resources.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      {destinations.pipelines?.hasMore && <p className="text-xs text-muted-foreground">More pipelines are available. Ask the Agent to find a pipeline by name.</p>}
      <label className="block text-xs font-medium">Stage<select aria-label="CRM stage" className={selectStyle} value={stage} onChange={e => setStage(e.target.value)}><option value="">Choose stage</option>{destinations.pipelines?.resources.find(p => p.id === pipeline)?.stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"><input type="checkbox" className={nativeCheckboxClass} checked={createDeals} onChange={e => setCreateDeals(e.target.checked)} /> Also create deals for new contacts</label>
      <Button size="sm" disabled={busy || !leadIds.length || !destinations.workspaceId || !pipeline || !stage} onClick={() => run(async () => {
        setProposal(await request("prepare", { listId, leadIds, destinationWorkspaceId: destinations.workspaceId, pipelineId: pipeline, stageId: stage, createDeals }))
        setHistory(await request("history"))
      })}>Preview transfer</Button>
    </>}
    {history.filter(h => h.metadata.listId === listId).map(h => <Button key={h.id} variant="ghost" size="sm" className="h-auto max-w-full whitespace-normal text-left" disabled={busy} onClick={() => run(async () => setProposal(await request("status", { proposalId: h.metadata.proposalId })))}>Restore transfer · {new Date(h.createdAt).toLocaleString()}</Button>)}
    {proposal && <section aria-label="CRM transfer preview" className="min-w-0 space-y-2">
      <p role="status" className="text-sm font-semibold">Transfer: {proposal.status}</p>
      <pre className={codeBlockClass}>{JSON.stringify({ preview: proposal.preview, result: proposal.result }, null, 2)}</pre>
      <a className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline" href={proposal.approvalUrl} target="_blank" rel="noopener noreferrer">Review and approve in CRM</a>
      {proposal.result?.records?.flatMap(r => [r.contact, r.deal]).filter(r => r?.url.startsWith('/admin/')).map(r => <p key={r!.url}><a className="text-sm font-medium text-primary underline-offset-4 hover:underline" href={new URL(r!.url, proposal.approvalUrl).href} target="_blank" rel="noopener noreferrer">Open {r!.name}</a></p>)}
      <Button size="sm" variant="outline" disabled={busy} onClick={() => run(async () => setProposal(await request("status", { proposalId: proposal.id })))}>Refresh progress</Button>
    </section>}
    {busy && <p role="status" className="text-xs text-muted-foreground">Loading transfer…</p>}
    {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
  </details>
}
