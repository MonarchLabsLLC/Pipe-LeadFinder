import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { verifyKeycloakToken } from "@/lib/keycloak-verify"
import { prisma } from "@/lib/prisma"

// Dev user for local development - bypasses all auth
const DEV_USER = {
  id: "dev-admin-001",
  email: "admin@GrooveDigital.com",
  name: "Dev Admin",
  role: "admin",
} as const

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        keycloakToken: { label: "Keycloak Token", type: "text" },
      },
      async authorize(credentials) {
        // ── Dev auto-login ──────────────────────────────────
        if (process.env.NODE_ENV === "development" || process.env.DEV_AUTO_LOGIN === "true") {
          return DEV_USER
        }

        // ── Keycloak token auth (production) ────────────────
        const token = credentials?.keycloakToken as string | undefined
        if (!token) return null

        try {
          const claims = await verifyKeycloakToken(token)

          // Upsert user in database, linking by keycloakSubId or email
          let user = await prisma.user.findUnique({
            where: { keycloakSubId: claims.sub },
          })

          if (!user && claims.email) {
            // Fallback: find by email for users migrated from dev-login
            user = await prisma.user.findUnique({
              where: { email: claims.email },
            })
            if (user) {
              // Link existing user to their Keycloak identity
              console.log(
                `[Auth] Linking existing user ${user.id} (${user.email}) to Keycloak sub ${claims.sub}`
              )
              user = await prisma.user.update({
                where: { id: user.id },
                data: { keycloakSubId: claims.sub },
              })
            }
          }

          if (!user) {
            // Create new user from Keycloak claims
            const fullName = claims.name ||
              [claims.given_name, claims.family_name].filter(Boolean).join(" ") ||
              claims.preferred_username ||
              claims.email ||
              "Unknown"

            user = await prisma.user.create({
              data: {
                email: claims.email!,
                name: fullName,
                keycloakSubId: claims.sub,
                role: "user",
              },
            })
            console.log(`[Auth] Created new user ${user.id} for ${user.email}`)
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name || "",
            role: user.role,
          }
        } catch (error) {
          console.error("[Auth] Keycloak token verification failed:", error)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as typeof DEV_USER).role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
  // Trust the host (Cloudflare terminates SSL in production)
  trustHost: true,
})

// Type augmentation for session
declare module "next-auth" {
  interface User {
    role?: string
  }
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: string
    }
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string
    role?: string
  }
}
