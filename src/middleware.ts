import { auth } from "@/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isDevMode = process.env.NODE_ENV === "development"
  const isAuthPage = req.nextUrl.pathname.startsWith("/login")
  const isApiRoute = req.nextUrl.pathname.startsWith("/api")
  const isDevLoginRoute = req.nextUrl.pathname === "/api/auth/dev-login"
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

  // In production, redirect to login if not logged in
  if (!isDevMode && !isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
}
