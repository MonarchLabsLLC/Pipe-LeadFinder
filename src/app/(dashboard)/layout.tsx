import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/sidebar"
import { Topbar } from "@/components/layout/topbar"
import { CreditsStatusBar } from "@/components/layout/credits-status-bar"
import { ScaleWorkspaceBridge } from "@/components/providers/scale-workspace-bridge"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      {/* Inert unless NEXT_PUBLIC_SCALE_TEAM_WORKSPACES_ENABLED=true */}
      <ScaleWorkspaceBridge />
      {/* The first tab stop on every page: past the sidebar and the header,
          straight to the screen's own content. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:ring-2 focus:ring-ring focus:outline-none"
      >
        Skip to content
      </a>
      <AppSidebar />
      {/* Same shell as PipeLeads Suite: the inset stays viewport-sized and the
          page scrolls inside <main>, which is what keeps the credits bar
          pinned below it without position: fixed. */}
      <SidebarInset className="h-svh min-w-0 overflow-hidden">
        <Topbar />
        <main
          id="main-content"
          tabIndex={-1}
          className="min-h-0 min-w-0 flex-1 overflow-auto p-6 outline-none"
        >
          {children}
        </main>
        <CreditsStatusBar />
      </SidebarInset>
    </SidebarProvider>
  )
}
