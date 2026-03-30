import { HelpCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
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
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="flex flex-col items-center gap-4 pt-8 pb-8">
          <HelpCircle className="h-12 w-12 text-muted-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">
            {page.title}
          </h1>
          <Badge variant="secondary">Coming Soon</Badge>
          <p className="text-muted-foreground">{page.description}</p>
          <p className="text-sm text-muted-foreground/70">
            This feature is under development and will be available in a
            future update.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
