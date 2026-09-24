import type { Metadata } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { SessionProvider } from "@/components/providers/session-provider"
import { QueryProvider } from "@/components/providers/query-provider"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { CreditsProvider } from "@/contexts/credits-context"
import { Toaster } from "@/components/ui/sonner"

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
})

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
})

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
      data-scroll-behavior="smooth"
      className="scroll-smooth"
      suppressHydrationWarning
    >
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        {/* Same theme wiring as PipeLeads Suite, so light/dark behaves the
            same in every PipeLeads app. */}
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <SessionProvider useDevAuth={useDevAuth}>
              <CreditsProvider>{children}</CreditsProvider>
            </SessionProvider>
          </QueryProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
