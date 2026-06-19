"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      closeButton
      richColors={false}
      duration={5200}
      gap={10}
      containerAriaLabel="PipeLeads notifications"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group-[.toaster]:min-h-16 group-[.toaster]:gap-3 group-[.toaster]:rounded-lg group-[.toaster]:border group-[.toaster]:border-border group-[.toaster]:bg-card group-[.toaster]:px-4 group-[.toaster]:py-3 group-[.toaster]:text-card-foreground group-[.toaster]:shadow-lg group-[.toaster]:shadow-black/10",
          title: "group-[.toaster]:text-sm group-[.toaster]:font-semibold group-[.toaster]:leading-5",
          description:
            "group-[.toaster]:mt-1 group-[.toaster]:text-xs group-[.toaster]:leading-5 group-[.toaster]:text-muted-foreground",
          icon: "group-[.toaster]:mt-0.5 group-[.toaster]:text-primary",
          success:
            "group-[.toaster]:border-emerald-200 group-[.toaster]:bg-emerald-50 group-[.toaster]:text-emerald-950 dark:group-[.toaster]:border-emerald-900 dark:group-[.toaster]:bg-emerald-950 dark:group-[.toaster]:text-emerald-50",
          error:
            "group-[.toaster]:border-destructive/25 group-[.toaster]:bg-card group-[.toaster]:text-card-foreground",
          warning:
            "group-[.toaster]:border-amber-200 group-[.toaster]:bg-amber-50 group-[.toaster]:text-amber-950 dark:group-[.toaster]:border-amber-900 dark:group-[.toaster]:bg-amber-950 dark:group-[.toaster]:text-amber-50",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
