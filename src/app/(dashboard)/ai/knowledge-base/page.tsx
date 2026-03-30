"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { toast } from "sonner"
import { Save, Loader2, Trash2, Globe, FileText, HelpCircle, File, Plus } from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BusinessProfile {
  id: string
  businessName: string | null
  businessWebsite: string | null
  whatYouSell: string | null
  whoItHelps: string | null
  whatItDoes: string | null
  contactPerson: string | null
  personality: string | null
}

interface DataSource {
  id: string
  type: "WEBSITE" | "TEXT" | "QA" | "PDF"
  content: string
  sourceUrl: string | null
  name: string | null
  createdAt: string
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchProfile(): Promise<BusinessProfile> {
  const res = await fetch("/api/ai/knowledge-base")
  if (!res.ok) throw new Error("Failed to fetch profile")
  return res.json()
}

async function updateProfile(data: Partial<BusinessProfile>) {
  const res = await fetch("/api/ai/knowledge-base", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to update profile")
  return res.json()
}

async function fetchSources(): Promise<DataSource[]> {
  const res = await fetch("/api/ai/knowledge-base/sources")
  if (!res.ok) throw new Error("Failed to fetch data sources")
  return res.json()
}

async function addSource(body: Record<string, unknown>): Promise<DataSource> {
  const res = await fetch("/api/ai/knowledge-base/sources", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? "Failed to add data source")
  }
  return res.json()
}

async function deleteSource(id: string) {
  const res = await fetch(`/api/ai/knowledge-base/sources/${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete data source")
  return res.json()
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function KnowledgeBasePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Knowledge Base</h1>
        <p className="text-muted-foreground mt-1">
          Configure your business profile and data sources to power AI-generated outreach.
        </p>
      </div>

      <BusinessProfileSection />
      <DataSourcesSection />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Business Profile Section
// ---------------------------------------------------------------------------

function BusinessProfileSection() {
  const queryClient = useQueryClient()
  const { data: profile, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["knowledge-base-profile"],
    queryFn: fetchProfile,
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading profile...
      </div>
    )
  }

  return (
    <BusinessProfileForm
      key={dataUpdatedAt}
      profile={profile ?? null}
      onSaved={() => queryClient.invalidateQueries({ queryKey: ["knowledge-base-profile"] })}
    />
  )
}

function BusinessProfileForm({
  profile,
  onSaved,
}: {
  profile: BusinessProfile | null
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    businessName: profile?.businessName ?? "",
    businessWebsite: profile?.businessWebsite ?? "",
    whatYouSell: profile?.whatYouSell ?? "",
    whoItHelps: profile?.whoItHelps ?? "",
    whatItDoes: profile?.whatItDoes ?? "",
    contactPerson: profile?.contactPerson ?? "",
    personality: profile?.personality ?? "",
  })

  const mutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      onSaved()
      toast.success("Business profile updated.")
    },
    onError: (err: Error) => toast.error(err.message),
  })

  function handleChange(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate(form)
  }

  const fields: { key: string; label: string; placeholder: string }[] = [
    { key: "businessName", label: "Business Name", placeholder: "Acme Corp" },
    { key: "businessWebsite", label: "Business Website", placeholder: "https://acme.com" },
    { key: "whatYouSell", label: "What do you sell?", placeholder: "SaaS marketing platform" },
    { key: "whoItHelps", label: "Who does it help?", placeholder: "Small business owners" },
    { key: "whatItDoes", label: "What does it do for them?", placeholder: "Helps them generate leads and close deals faster" },
    { key: "contactPerson", label: "Contact person name", placeholder: "Jane Smith" },
    { key: "personality", label: "Personality", placeholder: "Professional, Friendly" },
  ]

  return (
    <section>
      <h2 className="text-lg font-semibold mb-4">Your Business Profile</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {fields.map(({ key, label, placeholder }) => (
          <div key={key} className="space-y-1.5">
            <Label htmlFor={key}>{label}</Label>
            <Input
              id={key}
              value={(form as Record<string, string>)[key]}
              onChange={(e) => handleChange(key, e.target.value)}
              placeholder={placeholder}
            />
          </div>
        ))}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Update info
        </Button>
      </form>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Data Sources Section
// ---------------------------------------------------------------------------

function DataSourcesSection() {
  const queryClient = useQueryClient()

  const { data: sources = [], isLoading } = useQuery({
    queryKey: ["knowledge-base-sources"],
    queryFn: fetchSources,
  })

  const addMutation = useMutation({
    mutationFn: addSource,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-base-sources"] })
      toast.success("Data source added.")
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteSource,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-base-sources"] })
      toast.success("Data source deleted.")
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <section className="space-y-6">
      <h2 className="text-lg font-semibold">Add New Data Source</h2>

      <Tabs defaultValue="website">
        <TabsList>
          <TabsTrigger value="website">
            <Globe className="mr-1.5 h-4 w-4" /> Website
          </TabsTrigger>
          <TabsTrigger value="text">
            <FileText className="mr-1.5 h-4 w-4" /> Text
          </TabsTrigger>
          <TabsTrigger value="qa">
            <HelpCircle className="mr-1.5 h-4 w-4" /> Q&A
          </TabsTrigger>
          <TabsTrigger value="pdf">
            <File className="mr-1.5 h-4 w-4" /> PDF
          </TabsTrigger>
        </TabsList>

        <TabsContent value="website">
          <WebsiteTab
            onAdd={(body) => addMutation.mutateAsync(body)}
            isLoading={addMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="text">
          <TextTab
            onAdd={(body) => addMutation.mutateAsync(body)}
            isLoading={addMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="qa">
          <QATab
            onAdd={(body) => addMutation.mutateAsync(body)}
            isLoading={addMutation.isPending}
            sources={sources.filter((s) => s.type === "QA")}
          />
        </TabsContent>

        <TabsContent value="pdf">
          <PDFTab />
        </TabsContent>
      </Tabs>

      {/* Existing Data Sources */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">
          Existing Data Sources ({sources.length})
        </h3>

        {isLoading && (
          <div className="flex items-center gap-2 py-4 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        )}

        {!isLoading && sources.length === 0 && (
          <p className="text-sm text-muted-foreground py-4">
            No data sources yet. Add one above to get started.
          </p>
        )}

        {sources.map((source) => (
          <div
            key={source.id}
            className="flex items-start justify-between gap-3 rounded-lg border p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <SourceIcon type={source.type} />
                <span className="text-sm font-medium truncate">
                  {source.name ?? source.sourceUrl ?? source.type}
                </span>
                <span className="text-xs text-muted-foreground uppercase">{source.type}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {source.content.slice(0, 200)}
                {source.content.length > 200 ? "..." : ""}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-destructive hover:text-destructive"
              onClick={() => deleteMutation.mutate(source.id)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Tab: Website
// ---------------------------------------------------------------------------

function WebsiteTab({
  onAdd,
  isLoading,
}: {
  onAdd: (body: Record<string, unknown>) => Promise<unknown>
  isLoading: boolean
}) {
  const [websiteUrl, setWebsiteUrl] = useState("")
  const [linkUrl, setLinkUrl] = useState("")

  async function handleCrawlWebsite() {
    if (!websiteUrl.trim()) return
    await onAdd({ type: "WEBSITE", sourceUrl: websiteUrl.trim(), crawlMode: "website" })
    setWebsiteUrl("")
  }

  async function handleCrawlLink() {
    if (!linkUrl.trim()) return
    await onAdd({ type: "WEBSITE", sourceUrl: linkUrl.trim(), crawlMode: "link" })
    setLinkUrl("")
  }

  return (
    <div className="space-y-4 pt-3">
      <div className="space-y-2">
        <Label>Add a new website</Label>
        <div className="flex gap-2">
          <Input
            placeholder="https://example.com"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
          />
          <Button onClick={handleCrawlWebsite} disabled={isLoading || !websiteUrl.trim()}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Globe className="mr-2 h-4 w-4" />}
            Crawl Web
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Or, add a single link</Label>
        <div className="flex gap-2">
          <Input
            placeholder="https://example.com/about"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
          />
          <Button variant="secondary" onClick={handleCrawlLink} disabled={isLoading || !linkUrl.trim()}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Globe className="mr-2 h-4 w-4" />}
            Crawl Link
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: Text
// ---------------------------------------------------------------------------

function TextTab({
  onAdd,
  isLoading,
}: {
  onAdd: (body: Record<string, unknown>) => Promise<unknown>
  isLoading: boolean
}) {
  const [text, setText] = useState("")

  async function handleSave() {
    if (!text.trim()) return
    await onAdd({ type: "TEXT", content: text.trim(), name: "Custom text" })
    setText("")
  }

  return (
    <div className="space-y-3 pt-3">
      <Textarea
        rows={6}
        placeholder="Paste or type text content about your business..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <Button onClick={handleSave} disabled={isLoading || !text.trim()}>
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Save
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: Q&A
// ---------------------------------------------------------------------------

function QATab({
  onAdd,
  isLoading,
  sources,
}: {
  onAdd: (body: Record<string, unknown>) => Promise<unknown>
  isLoading: boolean
  sources: DataSource[]
}) {
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState("")

  async function handleAdd() {
    if (!question.trim() || !answer.trim()) return
    const content = JSON.stringify({ question: question.trim(), answer: answer.trim() })
    await onAdd({ type: "QA", content, name: question.trim().slice(0, 80) })
    setQuestion("")
    setAnswer("")
  }

  return (
    <div className="space-y-4 pt-3">
      <div className="space-y-2">
        <Label>Question</Label>
        <Input
          placeholder="What services do you offer?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Answer</Label>
        <Textarea
          rows={4}
          placeholder="We offer..."
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
        />
      </div>
      <Button onClick={handleAdd} disabled={isLoading || !question.trim() || !answer.trim()}>
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
        Add
      </Button>

      {sources.length > 0 && (
        <div className="space-y-2 pt-2">
          <h4 className="text-sm font-medium text-muted-foreground">Existing Q&A pairs</h4>
          {sources.map((s) => {
            let qa: { question?: string; answer?: string } = {}
            try {
              qa = JSON.parse(s.content)
            } catch {
              /* ignore */
            }
            return (
              <div key={s.id} className="rounded-md border p-3 text-sm space-y-1">
                <p className="font-medium">Q: {qa.question ?? s.content}</p>
                <p className="text-muted-foreground">A: {qa.answer ?? ""}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: PDF
// ---------------------------------------------------------------------------

function PDFTab() {
  const [fileName, setFileName] = useState("")

  return (
    <div className="space-y-3 pt-3">
      <Label>Upload PDF</Label>
      <Input
        type="file"
        accept=".pdf"
        onChange={(e) => {
          const file = e.target.files?.[0]
          setFileName(file?.name ?? "")
        }}
      />
      {fileName && (
        <p className="text-sm text-muted-foreground">
          Selected: {fileName} (upload functionality coming soon)
        </p>
      )}
      <Button variant="secondary" disabled>
        Upload (coming soon)
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function SourceIcon({ type }: { type: DataSource["type"] }) {
  switch (type) {
    case "WEBSITE":
      return <Globe className="h-4 w-4 text-blue-500" />
    case "TEXT":
      return <FileText className="h-4 w-4 text-green-500" />
    case "QA":
      return <HelpCircle className="h-4 w-4 text-amber-500" />
    case "PDF":
      return <File className="h-4 w-4 text-red-500" />
  }
}
