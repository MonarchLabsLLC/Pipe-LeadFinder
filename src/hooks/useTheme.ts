"use client"

import { useState, useEffect, useCallback } from "react"

export type ThemeName = "amber" | "indigo"
export type ColorMode = "light" | "dark"

export const THEMES: { value: ThemeName; label: string }[] = [
  { value: "amber", label: "Warm" },
  { value: "indigo", label: "Cool" },
]

const THEME_KEY = "scale-theme"
const COLOR_MODE_KEY = "scale-color-mode"

function getStoredTheme(): ThemeName {
  if (typeof window === "undefined") return "amber"
  const stored = localStorage.getItem(THEME_KEY) as ThemeName
  if (!stored || stored === ("legacy" as string) || stored === ("amber-soft" as string)) return "amber"
  if (stored === ("indigo-soft" as string)) return "indigo"
  return stored
}

function getStoredColorMode(): ColorMode {
  if (typeof window === "undefined") return "light"
  return (localStorage.getItem(COLOR_MODE_KEY) as ColorMode) || "light"
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeName>(getStoredTheme)
  const [colorMode, setColorModeState] = useState<ColorMode>(getStoredColorMode)

  // Apply theme + color mode to the document
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute("data-theme", theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    const root = document.documentElement
    if (colorMode === "dark") {
      root.classList.add("dark")
    } else {
      root.classList.remove("dark")
    }
    localStorage.setItem(COLOR_MODE_KEY, colorMode)
  }, [colorMode])

  const setTheme = useCallback((t: ThemeName) => {
    setThemeState(t)
  }, [])

  const setColorMode = useCallback((m: ColorMode) => {
    setColorModeState(m)
  }, [])

  const toggleColorMode = useCallback(() => {
    setColorModeState((prev) => (prev === "light" ? "dark" : "light"))
  }, [])

  return { theme, colorMode, setTheme, setColorMode, toggleColorMode }
}
