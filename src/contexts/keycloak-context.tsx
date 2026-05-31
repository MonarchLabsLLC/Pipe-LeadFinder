"use client"

/**
 * Keycloak Context Provider
 *
 * Handles Keycloak authentication on the client side, then bridges to
 * NextAuth by calling signIn("credentials") with the verified token.
 * This preserves the existing auth() / useSession() patterns throughout the app.
 *
 * Skipped entirely in development mode (DEV_AUTO_LOGIN handles auth).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"
import { signIn, useSession } from "next-auth/react"
import {
  initKeycloak,
  login as keycloakLogin,
  logout as keycloakLogout,
  getToken,
  getTokenParsed,
  REQUIRED_ROLE,
} from "@/lib/keycloak-client"

interface KeycloakContextType {
  isKeycloakReady: boolean
  isKeycloakAuthenticated: boolean
  keycloakUser: Record<string, unknown> | null
  login: () => void
  logout: () => void
  hasRequiredRole: boolean
}

const KeycloakContext = createContext<KeycloakContextType>({
  isKeycloakReady: false,
  isKeycloakAuthenticated: false,
  keycloakUser: null,
  login: () => {},
  logout: () => {},
  hasRequiredRole: false,
})

export function useKeycloak() {
  return useContext(KeycloakContext)
}

export function KeycloakProvider({ children }: { children: React.ReactNode }) {
  const [isKeycloakReady, setIsKeycloakReady] = useState(false)
  const [isKeycloakAuthenticated, setIsKeycloakAuthenticated] = useState(false)
  const [keycloakUser, setKeycloakUser] = useState<Record<string, unknown> | null>(null)
  const [hasRequiredRole, setHasRequiredRole] = useState(false)
  const [roleCheckFailed, setRoleCheckFailed] = useState(false)
  const { status: sessionStatus } = useSession()

  useEffect(() => {
    async function init() {
      try {
        const authenticated = await initKeycloak()

        if (authenticated) {
          const tokenParsed = getTokenParsed()
          const token = getToken()

          setKeycloakUser(tokenParsed ?? null)
          setIsKeycloakAuthenticated(true)
          setHasRequiredRole(true) // initKeycloak returns false if role missing

          // Bridge to NextAuth: create a session from the Keycloak token
          // Only do this if we don't already have a NextAuth session
          if (sessionStatus !== "authenticated" && token) {
            try {
              await signIn("credentials", {
                keycloakToken: token,
                redirect: false,
              })
              console.log("[KeycloakProvider] NextAuth session created from Keycloak token")
            } catch (error) {
              console.error("[KeycloakProvider] Failed to bridge to NextAuth:", error)
            }
          }
        } else {
          // initKeycloak returned false — either not authenticated or missing role.
          // Check if user IS authenticated but lacks the role.
          const tokenParsed = getTokenParsed()
          if (tokenParsed) {
            // Authenticated but missing app_pipefinder role
            setIsKeycloakAuthenticated(true)
            setRoleCheckFailed(true)
            setHasRequiredRole(false)
          } else {
            // Not authenticated — redirect to Keycloak login (ScalePlus/Groove themed).
            // redirect_uri is set to app.pipeleads.ai so user lands back here after login.
            setIsKeycloakAuthenticated(false)
            setHasRequiredRole(false)
            keycloakLogin()
            return // Don't set ready, we're redirecting
          }
        }
      } catch (error) {
        console.error("[KeycloakProvider] Initialization error:", error)
        setIsKeycloakAuthenticated(false)
        setKeycloakUser(null)
        setHasRequiredRole(false)
      } finally {
        setIsKeycloakReady(true)
      }
    }

    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = useCallback(() => {
    keycloakLogin()
  }, [])

  const logout = useCallback(() => {
    setIsKeycloakAuthenticated(false)
    setKeycloakUser(null)
    setHasRequiredRole(false)
    keycloakLogout()
  }, [])

  // Loading state while Keycloak initializes
  if (!isKeycloakReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">Authenticating...</p>
        </div>
      </div>
    )
  }

  // Authenticated but missing the required role (no active subscription)
  if (roleCheckFailed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="mx-auto max-w-lg rounded-xl border bg-card p-10 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <svg className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </div>
          <h1 className="mb-2 text-2xl font-bold text-foreground">Unlock PipeLeads</h1>
          <p className="mb-2 text-base text-muted-foreground">
            Your account doesn{"'"}t have an active PipeLeads subscription yet.
          </p>
          <p className="mb-6 text-sm text-muted-foreground">
            PipeLeads is the AI-powered lead intelligence platform that helps you find, enrich, and
            engage high-quality prospects in seconds. Get unlimited searches, email enrichment,
            AI-written outreach, and more.
          </p>
          <div className="flex flex-col gap-3">
            <a
              href="https://scaleplus.gg"
              className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
            >
              Get Started on ScalePlus
              <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </a>
            <button
              onClick={logout}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <KeycloakContext.Provider
      value={{
        isKeycloakReady,
        isKeycloakAuthenticated,
        keycloakUser,
        login,
        logout,
        hasRequiredRole,
      }}
    >
      {children}
    </KeycloakContext.Provider>
  )
}
