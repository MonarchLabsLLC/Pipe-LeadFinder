/**
 * Returns a human-readable relative timestamp string.
 * Examples: "just now", "2d ago", "3mos ago", "1y ago"
 */
export function formatRelativeTime(date: Date | string): string {
  const now = Date.now()
  const then = new Date(date).getTime()
  const seconds = Math.floor((now - then) / 1000)

  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mos ago`
  const years = Math.floor(months / 12)
  return `${years}y ago`
}

/**
 * Returns initials from a name string.
 * "John Doe" -> "JD", "Alice" -> "A", "" -> "?"
 */
export function getInitials(name: string): string {
  if (!name?.trim()) return "?"
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
