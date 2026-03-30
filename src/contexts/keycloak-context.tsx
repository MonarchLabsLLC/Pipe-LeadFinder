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
            // Authenticated but missing App_pipefinder role
            setIsKeycloakAuthenticated(true)
            setRoleCheckFailed(true)
            setHasRequiredRole(false)
          } else {
            // Not authenticated at all — redirect to Keycloak login
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

  // Authenticated but missing the required role
  if (roleCheckFailed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="mx-auto max-w-md rounded-lg border bg-card p-8 text-center shadow-sm">
          <h1 className="mb-2 text-xl font-semibold text-foreground">Access Denied</h1>
          <p className="mb-4 text-sm text-muted-foreground">
            Your account does not have the <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{REQUIRED_ROLE}</code> role
            required to access PipeLeads.
          </p>
          <p className="mb-6 text-sm text-muted-foreground">
            Contact your administrator to request access.
          </p>
          <button
            onClick={logout}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Sign out
          </button>
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
