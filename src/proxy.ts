import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { enforceScaleWorkspaceGate } from "@/lib/scale-workspace/gate"

/**
 * Lightweight request proxy. Session checking is intentionally limited to the
 * Auth.js cookie so this boundary does not pull database work into routing.
 * The Scale Plus team-workspace guest gate below is a no-op unless
 * SCALE_TEAM_WORKSPACES_ENABLED=true AND a sealed guest cookie is present.
 */

const isDevMode =
  process.env.NODE_ENV === "development" &&
  process.env.DEV_AUTO_LOGIN === "true"

export async function proxy(req: NextRequest) {
  const isApiRoute = req.nextUrl.pathname.startsWith("/api")
  const isLandingPage = req.nextUrl.pathname === "/"
  const isAuthPage = req.nextUrl.pathname.startsWith("/login")

  // API routes perform their own session checks. The public landing and auth
  // pages must remain accessible without a session.
  if (isApiRoute || isLandingPage || isAuthPage) {
    if (isApiRoute) {
      // Fail-closed guest workspace enforcement: classification allowlist plus
      // a central authorize call on EVERY guest request.
      const deniedByWorkspaceGate = await enforceScaleWorkspaceGate(req)
      if (deniedByWorkspaceGate) return deniedByWorkspaceGate
    }
    return NextResponse.next()
  }

  const sessionCookie =
    req.cookies.get("__Secure-authjs.session-token") ??
    req.cookies.get("authjs.session-token")
  const isLoggedIn = Boolean(sessionCookie)

  if (isDevMode && !isLoggedIn) {
    const devLoginUrl = new URL("/api/auth/dev-login", req.nextUrl.origin)
    devLoginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname)
    return NextResponse.redirect(devLoginUrl)
  }

  // Production authentication is completed by KeycloakProvider, which bridges
  // the verified Keycloak token into an Auth.js session before rendering.
  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|silent-check-sso\\.html|.*\\..*).*)",
  ],
}
