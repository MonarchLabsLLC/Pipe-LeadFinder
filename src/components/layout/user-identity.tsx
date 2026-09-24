"use client"

import { useCallback } from "react"
import { signOut } from "next-auth/react"

import { useKeycloak } from "@/contexts/keycloak-context"
import { cn } from "@/lib/utils"

export function getInitials(name?: string | null, email?: string | null): string {
  if (name) {
    return name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }
  if (email) return email[0].toUpperCase()
  return "U"
}

/**
 * The initials avatar, in the Suite's default avatar colour, so the same
 * person looks the same in the header, the sidebar and every PipeLeads app.
 */
export function UserAvatar({
  name,
  email,
  className,
}: {
  name?: string | null
  email?: string | null
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        className
      )}
      style={{ backgroundColor: "var(--cat-violet)", color: "var(--cat-foreground)" }}
    >
      {getInitials(name, email)}
    </span>
  )
}

/** Log out the way every account menu in Lead Finder does: Auth.js, then Keycloak. */
export function useLogout() {
  const { isKeycloakReady, logout: keycloakLogout } = useKeycloak()
  return useCallback(() => {
    if (isKeycloakReady) {
      signOut({ redirect: false }).finally(keycloakLogout)
    } else {
      signOut({ callbackUrl: "/" })
    }
  }, [isKeycloakReady, keycloakLogout])
}
