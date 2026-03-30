import Keycloak from "keycloak-js"

// Keycloak configuration from environment variables
const keycloakConfig = {
  url:
    process.env.NEXT_PUBLIC_KEYCLOAK_URL || "https://auth.groovetech.io/auth",
  realm: process.env.NEXT_PUBLIC_KEYCLOAK_REALM || "gd-apis-live",
  clientId:
    process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || "app-pipefinder",
}

// Required role for accessing the application
const REQUIRED_ROLE = "App_pipefinder"

// Create Keycloak instance
const keycloak = new Keycloak(keycloakConfig)

// Token caching to prevent loss during SSO checks
let cachedToken: string | undefined
let cachedRefreshToken: string | undefined

// Initialize Keycloak with SSO check
export async function initKeycloak(): Promise<boolean> {
  try {
    const authenticated = await keycloak.init({
      onLoad: "check-sso",
      silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
      checkLoginIframe: false,
      pkceMethod: "S256",
    })

    if (authenticated) {
      // Cache tokens immediately
      cachedToken = keycloak.token
      cachedRefreshToken = keycloak.refreshToken

      // Check for required role
      if (!hasRequiredRole()) {
        console.warn(
          "[Keycloak] User does not have required role:",
          REQUIRED_ROLE
        )
        return false
      }

      // Set up token refresh
      setupTokenRefresh()

      // Set up session monitoring
      setupSessionMonitoring()

      console.log("[Keycloak] Authenticated successfully")
    }

    return authenticated
  } catch (error) {
    console.error("[Keycloak] Initialization failed:", error)
    return false
  }
}

// Check if user has the required role
function hasRequiredRole(): boolean {
  const roles = keycloak.tokenParsed?.realm_access?.roles || []
  return roles.includes(REQUIRED_ROLE)
}

// Set up automatic token refresh
const SESSION_CHECK_INTERVAL_MS = 30_000

function setupTokenRefresh(): void {
  keycloak.onTokenExpired = () => {
    console.log("[Keycloak] Token expired, refreshing...")
    keycloak
      .updateToken(30)
      .then((refreshed) => {
        if (refreshed) {
          cachedToken = keycloak.token
          cachedRefreshToken = keycloak.refreshToken
          console.log("[Keycloak] Token refreshed successfully")
        }
      })
      .catch(() => {
        console.error(
          "[Keycloak] Token refresh failed, redirecting to login"
        )
        keycloak.login()
      })
  }

  // Periodically verify the session is still valid by forcing a token refresh.
  // This detects cross-app logout without relying on third-party cookies.
  setInterval(() => {
    keycloak
      .updateToken(-1) // -1 forces refresh regardless of expiry
      .then(() => {
        cachedToken = keycloak.token
        cachedRefreshToken = keycloak.refreshToken
      })
      .catch(() => {
        console.warn(
          "[Keycloak] Session no longer valid, redirecting to login"
        )
        cachedToken = undefined
        cachedRefreshToken = undefined
        keycloak.login()
      })
  }, SESSION_CHECK_INTERVAL_MS)
}

// Set up session monitoring
function setupSessionMonitoring(): void {
  keycloak.onAuthLogout = () => {
    console.log("[Keycloak] Auth logout detected")
    cachedToken = undefined
    cachedRefreshToken = undefined
    if (!keycloak.refreshToken) {
      window.location.href = "/"
    }
  }

  let refreshRecoveryAttempted = false

  keycloak.onAuthRefreshError = () => {
    if (refreshRecoveryAttempted) {
      cachedToken = undefined
      cachedRefreshToken = undefined
      window.location.href = "/"
      return
    }
    refreshRecoveryAttempted = true
    console.warn("[Keycloak] Auth refresh error, attempting recovery")
    keycloak
      .updateToken(60)
      .then((refreshed) => {
        if (!refreshed) {
          cachedToken = undefined
          cachedRefreshToken = undefined
          window.location.href = "/"
        } else {
          refreshRecoveryAttempted = false
        }
      })
      .catch(() => {
        cachedToken = undefined
        cachedRefreshToken = undefined
        window.location.href = "/"
      })
  }

  keycloak.onAuthError = (errorData) => {
    console.error("[Keycloak] Authentication error:", errorData)
  }

  keycloak.onAuthRefreshSuccess = () => {
    cachedToken = keycloak.token
    cachedRefreshToken = keycloak.refreshToken
  }
}

// Get the current access token (with caching fallback)
export function getToken(): string | undefined {
  return keycloak.token || cachedToken
}

// Get the refresh token
export function getRefreshToken(): string | undefined {
  return keycloak.refreshToken || cachedRefreshToken
}

// Trigger Keycloak login
export function login(): void {
  keycloak.login()
}

// Logout — redirects to Keycloak logout endpoint
export function logout(): void {
  cachedToken = undefined
  cachedRefreshToken = undefined
  keycloak.logout({
    redirectUri: window.location.origin,
  })
}

// Get the parsed token (user info)
export function getTokenParsed(): Record<string, unknown> | undefined {
  return keycloak.tokenParsed as Record<string, unknown> | undefined
}

// Check if user is authenticated with the required role
export function isAuthenticated(): boolean {
  return !!keycloak.authenticated && hasRequiredRole()
}

// Update token if needed (returns promise)
export function updateToken(minValidity: number = 30): Promise<boolean> {
  return keycloak.updateToken(minValidity)
}

export { keycloak, REQUIRED_ROLE }
