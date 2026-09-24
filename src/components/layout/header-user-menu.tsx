"use client"

import Link from "next/link"
import { useSession } from "next-auth/react"
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
import { UserAvatar, useLogout } from "@/components/layout/user-identity"

/** The avatar and account menu, drawn like PipeLeads Suite's. */
export function HeaderUserMenu() {
  const { data: session } = useSession()
  const logout = useLogout()

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
          <UserAvatar name={session?.user?.name} email={email} />
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
          onSelect={logout}
          className="text-destructive focus:text-destructive"
        >
          <LogOut aria-hidden="true" className="mr-2 size-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
