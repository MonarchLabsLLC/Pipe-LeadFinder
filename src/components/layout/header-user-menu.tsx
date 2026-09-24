"use client"

import Link from "next/link"
import { signOut, useSession } from "next-auth/react"
import { GraduationCap, HelpCircle, LogOut, Webhook } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useKeycloak } from "@/contexts/keycloak-context"

function getInitials(name?: string | null, email?: string | null): string {
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

/** The avatar and account menu, drawn like PipeLeads Suite's. */
export function HeaderUserMenu() {
  const { data: session } = useSession()
  const { isKeycloakReady, logout: keycloakLogout } = useKeycloak()

  const name = session?.user?.name || "User"
  const email = session?.user?.email

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative size-8 rounded-full p-0"
          aria-label="Account menu"
        >
          {/* The Suite's default avatar colour, so the same person looks the
              same in every PipeLeads app. */}
          <span
            aria-hidden="true"
            className="flex size-8 items-center justify-center rounded-full text-xs font-semibold"
            style={{ backgroundColor: "var(--cat-violet)", color: "var(--cat-foreground)" }}
          >
            {getInitials(session?.user?.name, email)}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{name}</p>
            {email && (
              <p className="truncate text-xs leading-none text-muted-foreground">{email}</p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/resources/tutorials" className="flex items-center">
            <GraduationCap aria-hidden="true" className="mr-2 size-4" />
            <span>Tutorials</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/resources/integrations" className="flex items-center">
            <Webhook aria-hidden="true" className="mr-2 size-4" />
            <span>Integrations</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/resources/support" className="flex items-center">
            <HelpCircle aria-hidden="true" className="mr-2 size-4" />
            <span>Support</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            if (isKeycloakReady) {
              signOut({ redirect: false }).finally(keycloakLogout)
            } else {
              signOut({ callbackUrl: "/" })
            }
          }}
          className="text-destructive focus:text-destructive"
        >
          <LogOut aria-hidden="true" className="mr-2 size-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
