"use client"

import { FormEvent, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { appToast } from "@/lib/app-toast"
import { Loader2, Trash2, Webhook } from "lucide-react"

interface Integration {
  id: string
  name: string
  url: string
  enabled: boolean
}

export default function IntegrationsPage() {
  const queryClient = useQueryClient()
  const [name, setName] = useState("")
  const [url, setUrl] = useState("")
  const [secret, setSecret] = useState("")
  const integrations = useQuery({
    queryKey: ["integrations"],
    queryFn: async (): Promise<Integration[]> => {
      const response = await fetch("/api/integrations")
      if (!response.ok) throw new Error("Integrations could not be loaded")
      return response.json()
    },
  })
  const create = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, url, secret }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Integration could not be created")
      return result
    },
    onSuccess: () => {
      setName("")
      setUrl("")
      setSecret("")
      void queryClient.invalidateQueries({ queryKey: ["integrations"] })
      appToast.success("Webhook connected", "It is now available from lead bulk actions.")
    },
    onError: (error) => appToast.error("bulkAction", error),
  })

  async function remove(id: string) {
    const response = await fetch(`/api/integrations/${id}`, { method: "DELETE" })
    if (!response.ok) return appToast.error("bulkAction", new Error("Integration could not be deleted"))
    void queryClient.invalidateQueries({ queryKey: ["integrations"] })
    appToast.success("Integration removed")
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    create.mutate()
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader
        title="Integrations"
        description="Send selected leads to a signed HTTPS webhook."
      />

      <Card>
        <CardHeader>
          <CardTitle>Connect webhook</CardTitle>
          <CardDescription>
            Requests include an HMAC SHA-256 signature in X-PipeLeads-Signature.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="integration-name">Name</Label>
                <Input id="integration-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="CRM webhook" required />
                <p className="text-sm text-muted-foreground">Shown in lead bulk actions.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="integration-url">HTTPS URL</Label>
                <Input id="integration-url" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/webhooks/leads" required />
                <p className="text-sm text-muted-foreground">Where selected leads are posted.</p>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="integration-secret">Signing secret</Label>
                <Input id="integration-secret" type="password" minLength={16} value={secret} onChange={(event) => setSecret(event.target.value)} required />
                <p className="text-sm text-muted-foreground">At least 16 characters. Used to sign every request.</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t pt-6">
              <Button disabled={create.isPending}>
                {create.isPending && <Loader2 aria-hidden="true" className="size-4 animate-spin" />} Connect
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Connected webhooks</h2>
        {integrations.isLoading && (
          <div className="grid gap-3" aria-busy="true">
            <Skeleton className="h-[74px] rounded-lg" />
            <Skeleton className="h-[74px] rounded-lg" />
          </div>
        )}
        {integrations.data && integrations.data.length > 0 && (
          <ul className="grid gap-3">
            {integrations.data.map((integration) => (
              <li key={integration.id} className="flex min-w-0 items-center gap-3 rounded-lg border bg-card p-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Webhook aria-hidden="true" className="size-5 text-muted-foreground" />
                </span>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="font-medium">{integration.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{integration.url}</p>
                </div>
                <Button variant="ghost" size="icon" aria-label={`Delete ${integration.name}`} onClick={() => remove(integration.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        {integrations.data?.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-card px-4 py-10 text-center">
            <div className="relative">
              <div aria-hidden="true" className="absolute -inset-3 rounded-full border border-dashed border-border" />
              <div className="relative flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Webhook aria-hidden="true" className="size-5" />
              </div>
            </div>
            <div className="mt-2 max-w-sm space-y-1">
              <h3 className="text-base font-semibold tracking-tight">No webhooks connected yet</h3>
              <p className="text-sm text-muted-foreground">Connect one above to send leads from bulk actions.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
