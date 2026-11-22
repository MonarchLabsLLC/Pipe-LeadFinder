"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, Loader2, Puzzle, X } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { PLUGIN_ORIGIN_PARAM } from "@/lib/plugin-frame"

import { CreditCapForm } from "./credit-cap-form"

// /plugins: the plugins the account owner installed from the Scale Plugin
// Store, and what those plugins are waiting for the owner to approve.

interface Install {
  installId: string
  name: string
  description: string | null
  iconUrl: string | null
  origin: string | null
  monthlyCredits: number | null
  usedThisMonth: number
}

interface Proposal {
  id: string
  pluginName: string
  actionTitle: string
  title: string
  cost: { maximumCredits?: number; creditsPerUnit?: number; maximumUnits?: number; note?: string; kind?: string } | null
  effects: string[]
  list: { name?: string } | null
  expiresAt: string
}

interface PluginsData {
  installs: Install[]
  proposals: Proposal[]
  unavailable: string | null
}

async function loadPlugins(): Promise<PluginsData> {
  const response = await fetch("/api/plugins/installs")
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.error || "Plugins could not be loaded.")
  return body as PluginsData
}

/** What approving costs, in the owner's words. */
function costLine(cost: Proposal["cost"]): string {
  if (!cost) return ""
  if (cost.kind === "tokens") return "Uses metered AI, charged to your Scale Credits as it runs."
  if (typeof cost.maximumCredits !== "number") return cost.note ?? ""
  if (cost.maximumCredits === 0) return "Free."
  return `Up to ${cost.maximumCredits.toLocaleString()} Scale Credits${
    typeof cost.creditsPerUnit === "number" && typeof cost.maximumUnits === "number" ? ` (${cost.creditsPerUnit} each, at most ${cost.maximumUnits})` : ""
  }.`
}

function hoursLeft(expiresAt: string): string {
  const hours = Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 3_600_000))
  return hours <= 1 ? "Expires within the hour" : `Expires in ${hours} hours`
}

export function PluginsPage() {
  const queryClient = useQueryClient()
  const plugins = useQuery({ queryKey: ["plugins"], queryFn: loadPlugins, retry: false })

  const decide = useMutation({
    mutationFn: async (input: { id: string; decision: "approve" | "reject" }) => {
      const response = await fetch(`/api/plugins/proposals/${encodeURIComponent(input.id)}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: input.decision }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || "That could not be saved. Try again.")
      return { decision: input.decision, status: body?.status as string | undefined, error: (body?.result as { error?: string } | null)?.error }
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["plugins"] })
      if (result.decision === "reject") toast.success("Rejected. Nothing was started.")
      else if (result.status === "stale" || result.status === "needs_review") toast.error(result.error || "This could not be started. Nothing was charged.")
      else if (result.status === "expired") toast.error("This request had already expired.")
      else toast.success("Approved. The work has started.")
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "That could not be saved. Try again."),
  })

  const header = <PageHeader title="Plugins" description="Apps from the Scale Plugin Store that you connected to Lead Finder." />

  if (plugins.isLoading) {
    return (
      <div className="space-y-6">
        {header}
        <Skeleton className="h-32 rounded-lg" />
      </div>
    )
  }
  if (plugins.isError || !plugins.data) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState icon={Puzzle} title="Plugins are not available" description={plugins.error instanceof Error ? plugins.error.message : "Plugins could not be loaded."} />
      </div>
    )
  }

  const { installs, proposals, unavailable } = plugins.data

  return (
    <div className="space-y-6">
      {header}

      {proposals.length > 0 ? (
        <section className="space-y-3" aria-label="Waiting for your approval">
          <h2 className="text-sm font-semibold">Waiting for your approval</h2>
          {proposals.map((proposal) => (
            <Card key={proposal.id}>
              <CardHeader>
                <CardTitle className="text-base break-words">{proposal.title}</CardTitle>
                <CardDescription>
                  Asked by the plugin {proposal.pluginName}
                  {proposal.list?.name ? ` · List: ${proposal.list.name}` : ""} · {hoursLeft(proposal.expiresAt)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {costLine(proposal.cost) ? <p className="text-sm font-medium">{costLine(proposal.cost)}</p> : null}
                {proposal.cost?.note && typeof proposal.cost.maximumCredits === "number" ? <p className="text-sm text-muted-foreground">{proposal.cost.note}</p> : null}
                {proposal.effects.length > 0 ? (
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {proposal.effects.map((effect) => (
                      <li key={effect}>{effect}</li>
                    ))}
                  </ul>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ id: proposal.id, decision: "approve" })}>
                    {decide.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => decide.mutate({ id: proposal.id, decision: "reject" })}>
                    <X className="size-4" aria-hidden />
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      ) : null}

      {installs.length === 0 ? (
        <EmptyState
          icon={Puzzle}
          title="No plugins yet"
          description={unavailable ?? "Plugins you install from the Scale Plugin Store and connect to Lead Finder show up here."}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {installs.map((install) => (
            <Card key={install.installId}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  {install.iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={install.iconUrl} alt="" className="size-6 rounded" referrerPolicy="no-referrer" />
                  ) : (
                    <Puzzle className="size-5 text-muted-foreground" aria-hidden />
                  )}
                  <span className="break-words">{install.name}</span>
                </CardTitle>
                {install.description ? <CardDescription>{install.description}</CardDescription> : null}
              </CardHeader>
              <CardContent className="space-y-4">
                {install.origin ? (
                  <Button asChild size="sm" variant="outline">
                    {/* A plain link: the plugin page needs a full page load at the
                        address that names the plugin's origin (see plugin-frame.tsx). */}
                    <a href={`/plugins/${encodeURIComponent(install.installId)}?${PLUGIN_ORIGIN_PARAM}=${encodeURIComponent(install.origin)}`}>Open</a>
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">This plugin works in the background and has no page to open.</p>
                )}
                <CreditCapForm installId={install.installId} name={install.name} monthlyCredits={install.monthlyCredits} usedThisMonth={install.usedThisMonth} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
