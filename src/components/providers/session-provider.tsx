"use client"

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react"
import { KeycloakProvider } from "@/contexts/keycloak-context"

const isDevMode =
  process.env.NODE_ENV === "development" ||
  process.env.NEXT_PUBLIC_DEV_AUTO_LOGIN === "true"

export function SessionProvider({ children }: { children: React.ReactNode }) {
  // In dev mode, skip Keycloak entirely — dev-auto-login handles auth
  if (isDevMode) {
    return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>
  }

  // In production, KeycloakProvider initializes keycloak-js (check-sso + silent SSO),
  // verifies App_pipefinder role, then bridges to NextAuth session via signIn().
  return (
    <NextAuthSessionProvider>
      <KeycloakProvider>{children}</KeycloakProvider>
    </NextAuthSessionProvider>
  )
}
