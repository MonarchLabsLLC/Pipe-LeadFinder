import type { Metadata } from "next"
import "./globals.css"
import { SessionProvider } from "@/components/providers/session-provider"
import { QueryProvider } from "@/components/providers/query-provider"
import { CreditsProvider } from "@/contexts/credits-context"
import { Toaster } from "@/components/ui/sonner"

export const metadata: Metadata = {
  title: "PipeLeads - LeadFinder AI",
  description: "AI-Powered Lead Intelligence Platform",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const useDevAuth =
    process.env.NODE_ENV === "development" &&
    process.env.DEV_AUTO_LOGIN === "true"

  return (
    <html
      lang="en"
      data-theme="amber"
      data-scroll-behavior="smooth"
      className="scroll-smooth"
    >
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      </head>
      <body className="font-sans antialiased">
        <QueryProvider>
          <SessionProvider useDevAuth={useDevAuth}>
            <CreditsProvider>{children}</CreditsProvider>
          </SessionProvider>
        </QueryProvider>
        <Toaster />
      </body>
    </html>
  )
}
