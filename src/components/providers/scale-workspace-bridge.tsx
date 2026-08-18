"use client"

/**
 * Scale Plus team workspace client bridge. Renders nothing and is completely
 * inert unless NEXT_PUBLIC_SCALE_TEAM_WORKSPACES_ENABLED === "true".
 *
 * Two flag-gated jobs:
 *  1. Resume a pending workspace launch: when the URL carries
 *     scale_workspace_code and the Auth.js session is established, bounce to
 *     the server callback that exchanges the code. (Unauthenticated launches
 *     are redirected here with the code preserved while KeycloakProvider
 *     completes sign-in.)
 *  2. In guest mode (reported by the sanitized display-context endpoint),
 *     attach the member's CURRENT Keycloak access token as an Authorization
 *     bearer header on same-origin /api requests so the proxy gate can run
 *     the central authorize call on every guest request.
 *
 * The display context is presentation data only and never authorizes anything.
 * Raw launch codes and tokens are never logged or persisted here.
 */

import { useEffect } from "react"
import { useSession } from "next-auth/react"
import { getToken, updateToken } from "@/lib/keycloak-client"

const CALLBACK_PATH = "/auth/scale-workspace/callback"

let interceptorInstalled = false

function installWorkspaceFetchInterceptor() {
  if (interceptorInstalled || typeof window === "undefined") return
  interceptorInstalled = true
  const originalFetch = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const href =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url
      const url = new URL(href, window.location.origin)
      if (
        url.origin === window.location.origin &&
        url.pathname.startsWith("/api/")
      ) {
        await updateToken(30).catch(() => undefined)
        const token = getToken()
        if (token) {
          const headers = new Headers(
            init?.headers ??
              (typeof input !== "string" && !(input instanceof URL)
                ? input.headers
                : undefined)
          )
          if (!headers.has("authorization")) {
            headers.set("Authorization", `Bearer ${token}`)
          }
          init = { ...init, headers }
        }
      }
    } catch {
      // Never break the request on interceptor errors; the server still
      // fails closed without the header.
    }
    return originalFetch(input, init)
  }
}

export function ScaleWorkspaceBridge() {
  const { status } = useSession()

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SCALE_TEAM_WORKSPACES_ENABLED !== "true") return
    if (typeof window === "undefined") return

    const params = new URLSearchParams(window.location.search)
    const code = params.get("scale_workspace_code")
    if (code) {
      if (status !== "authenticated") return // wait for the session bridge
      window.location.replace(
        `${CALLBACK_PATH}?scale_workspace_code=${encodeURIComponent(code)}`
      )
      return
    }

    if (status !== "authenticated") return
    let cancelled = false
    fetch("/api/scale-workspace/display-context")
      .then((res) => (res.ok ? res.json() : null))
      .then((info: { workspaceType?: string } | null) => {
        if (cancelled || info?.workspaceType !== "guest") return
        installWorkspaceFetchInterceptor()
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [status])

  return null
}
