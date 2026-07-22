"use client"

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react"
import { usePathname } from "next/navigation"
import { KeycloakProvider } from "@/contexts/keycloak-context"

export function SessionProvider({
  children,
  useDevAuth,
}: {
  children: React.ReactNode
  useDevAuth: boolean
}) {
  const pathname = usePathname()

  // In dev mode, skip Keycloak entirely — dev-auto-login handles auth
  // The marketing homepage is public in every environment and must not wait on
  // the logged-in app's Keycloak bootstrap before it can render.
  if (useDevAuth || pathname === "/") {
    return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>
  }

  // In production, KeycloakProvider initializes keycloak-js (check-sso + silent SSO),
  // verifies the app Keycloak role, then bridges to NextAuth session via signIn().
  return (
    <NextAuthSessionProvider>
      <KeycloakProvider>{children}</KeycloakProvider>
    </NextAuthSessionProvider>
  )
}
