import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Lightweight middleware — must NOT import auth.ts or prisma.ts because
 * Next.js 16 runs middleware in the Edge runtime which lacks Node.js
 * built-ins (node:path, node:fs, etc.) that Prisma requires.
 *
 * Session checking is done by looking for the NextAuth session cookie.
 */

const isDevMode =
  process.env.NODE_ENV === "development" ||
  process.env.DEV_AUTO_LOGIN === "true"

export function middleware(req: NextRequest) {
  const isApiRoute = req.nextUrl.pathname.startsWith("/api")
  const isLandingPage = req.nextUrl.pathname === "/"
  const isAuthPage = req.nextUrl.pathname.startsWith("/login")

  // Allow API routes, auth routes, and landing page to pass through
  if (isApiRoute || isLandingPage || isAuthPage) {
    return NextResponse.next()
  }

  // Check for NextAuth session cookie (works without importing auth.ts)
  const sessionCookie =
    req.cookies.get("__Secure-authjs.session-token") ??
    req.cookies.get("authjs.session-token")
  const isLoggedIn = !!sessionCookie

  // In development, redirect to dev-login if not logged in
  if (isDevMode && !isLoggedIn) {
    const devLoginUrl = new URL("/api/auth/dev-login", req.nextUrl.origin)
    devLoginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname)
    return NextResponse.redirect(devLoginUrl)
  }

  // In production, let pages through — KeycloakProvider handles auth
  // on the client side via keycloak-js (check-sso + silent SSO).
  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|silent-check-sso\\.html|.*\\..*).*)"],
}
