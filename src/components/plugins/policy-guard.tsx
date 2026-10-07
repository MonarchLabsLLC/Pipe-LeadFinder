"use client"

import { usePathname } from "next/navigation"

import { PluginFramePolicyReset } from "./plugin-frame"

/** The app shell's copy of PluginFramePolicyReset, fed the current path. */
export function PluginFramePolicyGuard() {
  return <PluginFramePolicyReset pathname={usePathname()} />
}
