"use client"

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react"
import { KeycloakProvider } from "@/contexts/keycloak-context"

export function SessionProvider({
  children,
  useDevAuth,
}: {
  children: React.ReactNode
  useDevAuth: boolean
}) {
  // In dev mode, skip Keycloak entirely — dev-auto-login handles auth
  if (useDevAuth) {
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
