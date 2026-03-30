import { auth } from "@/auth"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isDevMode =
    process.env.NODE_ENV === "development" ||
    process.env.DEV_AUTO_LOGIN === "true"
  const isAuthPage = req.nextUrl.pathname.startsWith("/login")
  const isApiRoute = req.nextUrl.pathname.startsWith("/api")
  const isLandingPage = req.nextUrl.pathname === "/"

  // Allow API routes, auth routes, and landing page to pass through
  if (isApiRoute || isLandingPage) {
    return NextResponse.next()
  }

  // In development, redirect to dev-login if not logged in
  if (isDevMode && !isLoggedIn && !isAuthPage) {
    const devLoginUrl = new URL("/api/auth/dev-login", req.nextUrl.origin)
    devLoginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname)
    return NextResponse.redirect(devLoginUrl)
  }

  // In production, let pages through — KeycloakProvider handles auth
  // on the client side via keycloak-js (check-sso + silent SSO).
  // API routes are protected individually by auth() checks in each handler.
  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|silent-check-sso\\.html|.*\\..*).*)"],
}
