"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, Search, type LucideIcon } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import {
  LEAD_FINDER_HOME,
  aiToolsMenu,
  appItems,
  isActivePath,
  leadSearchItems,
  resourceItems,
  type NavItem,
} from "@/components/layout/nav-config"
import { SidebarAccount } from "@/components/layout/sidebar-account"

/**
 * Lead Finder's sidebar. It mirrors PipeLeads Suite's app sidebar piece for
 * piece (header block, Apps group, separator, the app's own groups, rail) so
 * moving between the apps never changes the frame around the work.
 */
export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <AppIdentity />
      </SidebarHeader>

      <SidebarContent>
        {/* The PipeLeads apps, identical to the Suite's Apps group */}
        <SidebarGroup>
          <SidebarGroupLabel>Apps</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {appItems.map((app) => (
                <SidebarMenuItem key={app.title}>
                  <SidebarMenuButton
                    asChild
                    aria-current={app.current ? "true" : undefined}
                    tooltip={app.title}
                    className={cn(app.current && "font-semibold")}
                  >
                    {app.current ? (
                      <Link href={app.url}>
                        <app.icon className="size-4" />
                        <span>{app.title}</span>
                        <span aria-hidden className="ml-auto size-1.5 rounded-full bg-primary" />
                      </Link>
                    ) : (
                      <a href={app.url}>
                        <app.icon className="size-4" />
                        <span>{app.title}</span>
                      </a>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Lead Search</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavLinks items={leadSearchItems} pathname={pathname} />
              <NavSubmenu
                title={aiToolsMenu.title}
                icon={aiToolsMenu.icon}
                items={aiToolsMenu.items}
                pathname={pathname}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Resources</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavLinks items={resourceItems} pathname={pathname} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Who you are and your live credit balance, always in view. */}
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarAccount />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}

/** Styled exactly like the Suite's project switcher, but it names this app. */
function AppIdentity() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" asChild tooltip="Lead Finder">
          <Link href={LEAD_FINDER_HOME}>
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Search className="size-4" aria-hidden />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">Lead Finder</span>
              {/* The sidebar is dark in both themes: use its own muted text. */}
              <span className="truncate text-xs text-sidebar-muted-foreground">
                PipeLeads Lead Finder
              </span>
            </div>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function NavLinks({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return items.map((item) => (
    <SidebarMenuItem key={item.url}>
      <SidebarMenuButton asChild isActive={isActivePath(pathname, item.url)} tooltip={item.title}>
        <Link href={item.url}>
          <item.icon className="size-4" />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  ))
}

function NavSubmenu({
  title,
  icon: Icon,
  items,
  pathname,
}: {
  title: string
  icon: LucideIcon
  items: NavItem[]
  pathname: string
}) {
  const containsActive = items.some((item) => isActivePath(pathname, item.url))
  const { state, setOpen } = useSidebar()
  const [expanded, setExpanded] = React.useState(containsActive)

  return (
    <Collapsible
      asChild
      open={expanded}
      onOpenChange={setExpanded}
      className="group/collapsible"
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            tooltip={title}
            isActive={containsActive && state === "collapsed"}
            onClick={(event) => {
              // On the icon rail the submenu has nowhere to show: open the
              // sidebar with this submenu expanded instead.
              if (state === "collapsed") {
                event.preventDefault()
                setOpen(true)
                setExpanded(true)
              }
            }}
          >
            <Icon className="size-4" />
            <span>{title}</span>
            <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {items.map((item) => (
              <SidebarMenuSubItem key={item.url}>
                <SidebarMenuSubButton asChild isActive={isActivePath(pathname, item.url)}>
                  <Link href={item.url}>
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}
