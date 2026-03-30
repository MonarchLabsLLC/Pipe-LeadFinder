"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { MapPin, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"

export interface NominatimResult {
  display_name: string
  lat: string
  lon: string
  address?: {
    city?: string
    town?: string
    village?: string
    state?: string
    postcode?: string
    county?: string
    country?: string
  }
}

interface LocationAutocompleteProps {
  value: string
  onChange: (val: string) => void
  onSelect?: (result: NominatimResult) => void
  placeholder?: string
  className?: string
}

export function LocationAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Search location...",
  className,
}: LocationAutocompleteProps) {
  const [results, setResults] = useState<NominatimResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const searchLocation = useCallback(async (query: string) => {
    if (query.length < 3) {
      setResults([])
      return
    }
    setIsSearching(true)
    try {
      const res = await fetch("/api/location-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      })
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          setResults(data)
          setShowDropdown(true)
        }
      }
    } catch {
      /* silently fail */
    }
    setIsSearching(false)
  }, [])

  const handleInputChange = (val: string) => {
    onChange(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchLocation(val), 400)
  }

  const formatDisplayName = (result: NominatimResult): string => {
    const addr = result.address
    if (!addr) return result.display_name
    const city = addr.city || addr.town || addr.village || ""
    const state = addr.state || ""
    const zip = addr.postcode || ""
    if (city && state) return `${city}, ${state}${zip ? ` ${zip}` : ""}`
    return result.display_name.split(",").slice(0, 3).join(",")
  }

  return (
    <div ref={wrapperRef} className={`relative ${className || ""}`}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setShowDropdown(true)
          }}
          placeholder={placeholder}
          className="pl-9"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>
      {showDropdown && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border shadow-lg max-h-60 overflow-y-auto">
          {results.map((result, i) => (
            <button
              key={i}
              type="button"
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors border-b last:border-0"
              onClick={() => {
                const display = formatDisplayName(result)
                onChange(display)
                onSelect?.(result)
                setShowDropdown(false)
              }}
            >
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <span className="line-clamp-2">{formatDisplayName(result)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
