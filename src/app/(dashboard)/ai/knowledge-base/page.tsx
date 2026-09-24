"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { appToast } from "@/lib/app-toast"
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
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? "Failed to update profile")
  }
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

async function uploadPdfSource(file: File): Promise<{ source: DataSource }> {
  const formData = new FormData()
  formData.append("file", file)

  const res = await fetch("/api/ai/knowledge-base/sources/pdf", {
    method: "POST",
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? "Failed to upload PDF")
  }
  return res.json()
}

async function deleteSource(id: string) {
  const res = await fetch(`/api/ai/knowledge-base/sources/${id}`, { method: "DELETE" })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? "Failed to delete data source")
  }
  return res.json()
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function KnowledgeBasePage() {
  return (
    <div className="flex w-full max-w-4xl flex-col gap-6">
      <PageHeader
        title="Knowledge Base"
        description="Configure your business identity and connect data sources. This information powers all AI-generated outreach, summaries, and personalized messaging across the platform."
      />

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
  const { data: profile, isLoading, isError, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["knowledge-base-profile"],
    queryFn: fetchProfile,
  })

  if (isLoading) {
    return (
      <Card aria-busy="true" aria-label="Loading profile">
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    return (
      <ErrorState
        title="We could not load your business profile"
        message="Failed to load the business profile."
        onRetry={() => refetch()}
      />
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
      appToast.success(
        "Business profile updated",
        "Future AI messages will use the latest context."
      )
    },
    onError: (err: Error) => appToast.error("businessProfile", err),
  })

  function handleChange(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate(form)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden />
          Your Business Profile
        </CardTitle>
        <CardDescription>
          This information powers your AI-generated outreach content.
        </CardDescription>
      </CardHeader>

      <CardContent>
      <form onSubmit={handleSubmit} className="space-y-5">
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

        <div className="flex justify-end border-t pt-5">
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
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Data Sources Section
// ---------------------------------------------------------------------------

function DataSourcesSection() {
  const queryClient = useQueryClient()

  const { data: sources = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["knowledge-base-sources"],
    queryFn: fetchSources,
  })

  const addMutation = useMutation({
    mutationFn: addSource,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-base-sources"] })
      appToast.success(
        "Data source added",
        "AI outreach can now use this context."
      )
    },
    onError: (err: Error) => appToast.error("dataSource", err),
  })

  const pdfMutation = useMutation({
    mutationFn: uploadPdfSource,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-base-sources"] })
      appToast.success(
        "PDF source added",
        "AI outreach can now use the uploaded document."
      )
    },
    onError: (err: Error) => appToast.error("pdfSource", err),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteSource,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-base-sources"] })
      appToast.success(
        "Data source removed",
        "Future AI messages will skip that context."
      )
    },
    onError: (err: Error) => appToast.error("deleteDataSource", err),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-4 w-4 text-muted-foreground" aria-hidden />
          Data Sources
        </CardTitle>
        <CardDescription>
          Add context from your website, documents, or custom text.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <Tabs defaultValue="website">
          <TabsList className="w-full sm:w-fit">
            <TabsTrigger value="website" className="sm:px-3">
              <Globe aria-hidden /> Website
            </TabsTrigger>
            <TabsTrigger value="text" className="sm:px-3">
              <FileText aria-hidden /> Text
            </TabsTrigger>
            <TabsTrigger value="qa" className="sm:px-3">
              <HelpCircle aria-hidden /> Q&A
            </TabsTrigger>
            <TabsTrigger value="pdf" className="sm:px-3">
              <File aria-hidden /> PDF
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
            <PDFTab
              onUpload={(file) => pdfMutation.mutateAsync(file)}
              isLoading={pdfMutation.isPending}
            />
          </TabsContent>
        </Tabs>

        {/* Existing Data Sources */}
        <div className="space-y-3 border-t pt-6">
          <h3 className="text-sm font-medium">
            Existing sources
            <span className="ml-2 font-normal text-muted-foreground">{sources.length}</span>
          </h3>

          {isLoading && (
            <div className="space-y-2" aria-busy="true" aria-label="Loading data sources">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          )}

          {!isLoading && !isError && sources.length === 0 && (
            <EmptyState
              icon={Database}
              title="No data sources yet"
              description="Add one above to get started."
            />
          )}

          {isError && (
            <ErrorState
              message="Failed to load data sources."
              onRetry={() => refetch()}
            />
          )}

          <div className="space-y-2">
            {sources.map((source) => (
              <div
                key={source.id}
                className="flex items-center justify-between gap-3 rounded-md border px-3 py-3 transition-colors hover:bg-muted/50 sm:px-4"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <SourceIcon type={source.type} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {source.name ?? source.sourceUrl ?? source.type}
                      </span>
                      <Badge variant="secondary" className="shrink-0 text-[10px] uppercase tracking-wider">
                        {source.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 break-all">
                      {source.content.slice(0, 120)}
                      {source.content.length > 120 ? "..." : ""}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteMutation.mutate(source.id)}
                  disabled={deleteMutation.isPending}
                  aria-label={`Delete ${source.name ?? source.sourceUrl ?? source.type} source`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
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
    try {
      await onAdd({ type: "WEBSITE", sourceUrl: websiteUrl.trim(), crawlMode: "website" })
      setWebsiteUrl("")
    } catch {
      // The mutation reports the error through its onError handler.
    }
  }

  async function handleCrawlLink() {
    if (!linkUrl.trim()) return
    try {
      await onAdd({ type: "WEBSITE", sourceUrl: linkUrl.trim(), crawlMode: "link" })
      setLinkUrl("")
    } catch {
      // The mutation reports the error through its onError handler.
    }
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="space-y-2">
        <Label htmlFor="kb-crawl-website">Crawl entire website</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="kb-crawl-website"
            placeholder="https://example.com"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
          />
          <Button onClick={handleCrawlWebsite} disabled={isLoading || !websiteUrl.trim()} className="shrink-0">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Globe className="mr-2 h-4 w-4" />}
            Crawl Web
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="kb-crawl-link">Or add a single page</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="kb-crawl-link"
            placeholder="https://example.com/about"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
          />
          <Button variant="outline" onClick={handleCrawlLink} disabled={isLoading || !linkUrl.trim()} className="shrink-0">
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
    try {
      await onAdd({ type: "TEXT", content: text.trim(), name: "Custom text" })
      setText("")
    } catch {
      // The mutation reports the error through its onError handler.
    }
  }

  return (
    <div className="space-y-3 pt-4">
      <Textarea
        rows={6}
        aria-label="Text content"
        placeholder="Paste or type text content about your business..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isLoading || !text.trim()}>
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
    try {
      await onAdd({ type: "QA", content, name: question.trim().slice(0, 80) })
      setQuestion("")
      setAnswer("")
    } catch {
      // The mutation reports the error through its onError handler.
    }
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="space-y-2">
        <Label htmlFor="kb-qa-question">Question</Label>
        <Input
          id="kb-qa-question"
          placeholder="What services do you offer?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="kb-qa-answer">Answer</Label>
        <Textarea
          id="kb-qa-answer"
          rows={4}
          placeholder="We offer..."
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
        />
      </div>
      <div className="flex justify-end">
        <Button onClick={handleAdd} disabled={isLoading || !question.trim() || !answer.trim()}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Add
        </Button>
      </div>

      {sources.length > 0 && (
        <div className="space-y-2 pt-2">
          <h4 className="text-sm font-medium">Existing Q&A pairs</h4>
          {sources.map((s) => {
            let qa: { question?: string; answer?: string } = {}
            try {
              qa = JSON.parse(s.content)
            } catch {
              /* ignore */
            }
            return (
              <div key={s.id} className="space-y-1 rounded-md border bg-muted/50 p-3 text-sm">
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

function PDFTab({
  onUpload,
  isLoading,
}: {
  onUpload: (file: File) => Promise<unknown>
  isLoading: boolean
}) {
  const [file, setFile] = useState<File | null>(null)

  async function handleUpload() {
    if (!file) return
    try {
      await onUpload(file)
      setFile(null)
    } catch {
      // The mutation reports the error through its onError handler.
    }
  }

  return (
    <div className="space-y-3 pt-4">
      <Label htmlFor="kb-pdf">Upload PDF</Label>
      <Input
        id="kb-pdf"
        key={file?.name ?? "empty"}
        type="file"
        accept=".pdf"
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null)
        }}
      />
      {file && (
        <p className="text-sm text-muted-foreground">
          Selected: {file.name}
        </p>
      )}
      <Button disabled={isLoading || !file} onClick={handleUpload}>
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <File className="mr-2 h-4 w-4" />}
        {isLoading ? "Uploading..." : "Upload PDF"}
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function SourceIcon({ type }: { type: DataSource["type"] }) {
  const Icon = { WEBSITE: Globe, TEXT: FileText, QA: HelpCircle, PDF: File }[type]
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
      <Icon className="h-4 w-4" aria-hidden />
    </span>
  )
}
