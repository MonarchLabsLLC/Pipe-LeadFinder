import { HelpCircle } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"

const resourcePages: Record<string, { title: string; description: string }> = {
  support: {
    title: "Support",
    description: "Get help from our support team.",
  },
  tutorials: {
    title: "Tutorials",
    description: "Learn how to use PipeLeads effectively.",
  },
  documentation: {
    title: "Documentation",
    description: "Technical documentation and API reference.",
  },
}

export default async function ResourcesCatchAllPage({
  params,
}: {
  params: Promise<{ slug: string[] }>
}) {
  const { slug } = await params
  const key = slug[0]
  const page = resourcePages[key] ?? {
    title: "Resources",
    description: "This resource page is not yet available.",
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader
        title={page.title}
        description={page.description}
        actions={<Badge variant="secondary">Coming soon</Badge>}
      />
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border bg-card px-6 py-16 text-center">
        <div className="relative">
          <div aria-hidden="true" className="absolute -inset-3 rounded-full border border-dashed border-border" />
          <div className="relative flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <HelpCircle aria-hidden="true" className="size-6" />
          </div>
        </div>
        <div className="mt-2 max-w-sm space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">Coming soon</h2>
          <p className="text-sm text-muted-foreground">
            This feature is under development and will be available in a future update.
          </p>
        </div>
      </div>
    </div>
  )
}
