"use client"

import { FormEvent, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="text-sm text-muted-foreground">Send selected leads to a signed HTTPS webhook.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Webhook className="size-5" /> Connect webhook</CardTitle>
          <CardDescription>Requests include an HMAC SHA-256 signature in X-PipeLeads-Signature.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-3" onSubmit={submit}>
            <div className="space-y-2"><Label htmlFor="integration-name">Name</Label><Input id="integration-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="CRM webhook" required /></div>
            <div className="space-y-2"><Label htmlFor="integration-url">HTTPS URL</Label><Input id="integration-url" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/webhooks/leads" required /></div>
            <div className="space-y-2"><Label htmlFor="integration-secret">Signing secret</Label><Input id="integration-secret" type="password" minLength={16} value={secret} onChange={(event) => setSecret(event.target.value)} required /></div>
            <Button className="md:col-span-3 md:w-fit" disabled={create.isPending}>
              {create.isPending && <Loader2 className="size-4 animate-spin" />} Connect
            </Button>
          </form>
        </CardContent>
      </Card>
      <div className="space-y-3">
        {integrations.data?.map((integration) => (
          <Card key={integration.id}>
            <CardContent className="flex items-center gap-3 py-4">
              <Webhook className="size-4 text-muted-foreground" />
              <div className="min-w-0 flex-1"><p className="font-medium">{integration.name}</p><p className="truncate text-sm text-muted-foreground">{integration.url}</p></div>
              <Button variant="ghost" size="icon" aria-label={`Delete ${integration.name}`} onClick={() => remove(integration.id)}><Trash2 className="size-4" /></Button>
            </CardContent>
          </Card>
        ))}
        {integrations.isLoading && <Loader2 className="size-5 animate-spin" />}
        {integrations.data?.length === 0 && <p className="text-sm text-muted-foreground">No webhooks connected yet.</p>}
      </div>
    </div>
  )
}
