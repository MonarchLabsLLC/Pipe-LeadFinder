"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"
import { Save, Loader2, Trash2, Globe, FileText, HelpCircle, File, Plus, Building2, Database } from "lucide-react"

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
    <div className="mx-auto max-w-4xl space-y-8">
      <p className="text-muted-foreground text-sm leading-relaxed max-w-2xl">
        Configure your business identity and connect data sources. This information powers all
        AI-generated outreach, summaries, and personalized messaging across the platform.
      </p>

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
      <Card className="p-6">
        <div className="flex items-center gap-2 py-8 text-muted-foreground justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading profile...
        </div>
      </Card>
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

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Building2 className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-semibold">Your Business Profile</h2>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-6 ml-11">
        This information powers your AI-generated outreach content.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5 ml-11">
        {/* Row 1: Business Name | Business Website */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="businessName">Business Name</Label>
            <Input
              id="businessName"
              value={form.businessName}
              onChange={(e) => handleChange("businessName", e.target.value)}
              placeholder="Acme Corp"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="businessWebsite">Business Website</Label>
            <Input
              id="businessWebsite"
              value={form.businessWebsite}
              onChange={(e) => handleChange("businessWebsite", e.target.value)}
              placeholder="https://acme.com"
            />
          </div>
        </div>

        {/* Row 2: What do you sell? | Who does it help? */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="whatYouSell">What do you sell?</Label>
            <Input
              id="whatYouSell"
              value={form.whatYouSell}
              onChange={(e) => handleChange("whatYouSell", e.target.value)}
              placeholder="SaaS marketing platform"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="whoItHelps">Who does it help?</Label>
            <Input
              id="whoItHelps"
              value={form.whoItHelps}
              onChange={(e) => handleChange("whoItHelps", e.target.value)}
              placeholder="Small business owners"
            />
          </div>
        </div>

        {/* Row 3: What does it do for them? (full width) */}
        <div className="space-y-1.5">
          <Label htmlFor="whatItDoes">What does it do for them?</Label>
          <Input
            id="whatItDoes"
            value={form.whatItDoes}
            onChange={(e) => handleChange("whatItDoes", e.target.value)}
            placeholder="Helps them generate leads and close deals faster"
          />
        </div>

        {/* Row 4: Contact person name | Personality */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="contactPerson">Contact person name</Label>
            <Input
              id="contactPerson"
              value={form.contactPerson}
              onChange={(e) => handleChange("contactPerson", e.target.value)}
              placeholder="Jane Smith"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="personality">Personality</Label>
            <Input
              id="personality"
              value={form.personality}
              onChange={(e) => handleChange("personality", e.target.value)}
              placeholder="Professional, Friendly"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Update info
          </Button>
        </div>
      </form>
    </Card>
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
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Database className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-semibold">Data Sources</h2>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-6 ml-11">
        Add context from your website, documents, or custom text.
      </p>

      <div className="ml-11 space-y-6">
        <Tabs defaultValue="website">
          <TabsList className="bg-muted rounded-lg p-1 h-auto">
            <TabsTrigger value="website" className="rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm px-3 py-1.5 text-sm">
              <Globe className="mr-1.5 h-3.5 w-3.5" /> Website
            </TabsTrigger>
            <TabsTrigger value="text" className="rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm px-3 py-1.5 text-sm">
              <FileText className="mr-1.5 h-3.5 w-3.5" /> Text
            </TabsTrigger>
            <TabsTrigger value="qa" className="rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm px-3 py-1.5 text-sm">
              <HelpCircle className="mr-1.5 h-3.5 w-3.5" /> Q&A
            </TabsTrigger>
            <TabsTrigger value="pdf" className="rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm px-3 py-1.5 text-sm">
              <File className="mr-1.5 h-3.5 w-3.5" /> PDF
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
            Existing Sources ({sources.length})
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

          <div className="space-y-2">
            {sources.map((source) => (
              <div
                key={source.id}
                className="group flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <SourceIcon type={source.type} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {source.name ?? source.sourceUrl ?? source.type}
                      </span>
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground tracking-wider">
                        {source.type}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {source.content.slice(0, 120)}
                      {source.content.length > 120 ? "..." : ""}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                  onClick={() => deleteMutation.mutate(source.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
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
    <div className="space-y-4 pt-4">
      <div className="space-y-2">
        <Label className="text-sm">Crawl entire website</Label>
        <div className="flex gap-2">
          <Input
            placeholder="https://example.com"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
          />
          <Button onClick={handleCrawlWebsite} disabled={isLoading || !websiteUrl.trim()} size="sm" className="shrink-0">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Globe className="mr-2 h-4 w-4" />}
            Crawl Web
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Or add a single page</Label>
        <div className="flex gap-2">
          <Input
            placeholder="https://example.com/about"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
          />
          <Button variant="secondary" onClick={handleCrawlLink} disabled={isLoading || !linkUrl.trim()} size="sm" className="shrink-0">
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
    <div className="space-y-3 pt-4">
      <Textarea
        rows={6}
        placeholder="Paste or type text content about your business..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isLoading || !text.trim()} size="sm">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save
        </Button>
      </div>
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
    <div className="space-y-4 pt-4">
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
      <div className="flex justify-end">
        <Button onClick={handleAdd} disabled={isLoading || !question.trim() || !answer.trim()} size="sm">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Add
        </Button>
      </div>

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
              <div key={s.id} className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
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
    <div className="space-y-3 pt-4">
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
  const base = "h-4 w-4"
  switch (type) {
    case "WEBSITE":
      return <Globe className={`${base} text-blue-500`} />
    case "TEXT":
      return <FileText className={`${base} text-green-500`} />
    case "QA":
      return <HelpCircle className={`${base} text-amber-500`} />
    case "PDF":
      return <File className={`${base} text-red-500`} />
  }
}
