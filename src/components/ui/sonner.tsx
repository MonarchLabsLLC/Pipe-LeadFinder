"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

/**
 * Mounted once in the root layout. Identical to PipeLeads Suite's toaster:
 * every colour comes from the theme tokens (popover / border), so toasts look
 * the same in every PipeLeads app, in light and dark.
 */
const Toaster = (props: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="bottom-right"
      closeButton
      duration={5200}
      containerAriaLabel="PipeLeads notifications"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
