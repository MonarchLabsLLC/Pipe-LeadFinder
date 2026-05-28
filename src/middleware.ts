import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const isDevMode =
  process.env.NODE_ENV === "development" ||
  process.env.DEV_AUTO_LOGIN === "true"

export function middleware(req: NextRequest) {
  const isAuthPage = req.nextUrl.pathname.startsWith("/login")
  const isApiRoute = req.nextUrl.pathname.startsWith("/api")
  const isLandingPage = req.nextUrl.pathname === "/"

  // Allow API routes, auth routes, and landing page to pass through
  if (isApiRoute || isLandingPage || isAuthPage) {
    return NextResponse.next()
  }

  const isLoggedIn =
    req.cookies.has("__Secure-authjs.session-token") ||
    req.cookies.has("authjs.session-token")

  // In development, redirect to dev-login if not logged in
  if (isDevMode && !isLoggedIn) {
    const devLoginUrl = new URL("/api/auth/dev-login", req.nextUrl.origin)
    devLoginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname)
    return NextResponse.redirect(devLoginUrl)
  }

  // In production, let pages through — KeycloakProvider handles auth
  // on the client side via keycloak-js (check-sso + silent SSO).
  // API routes are protected individually by auth() checks in each handler.
  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|silent-check-sso\\.html|.*\\..*).*)"],
}
