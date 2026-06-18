'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'

// 44x44 tap target. Renders a stable placeholder until mounted to avoid a
// hydration mismatch (the resolved theme is only known client-side).
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isDark = resolvedTheme === 'dark'

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="flex h-11 w-11 items-center justify-center rounded-lg text-foreground hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {mounted ? (isDark ? '☀' : '☾') : ''}
    </button>
  )
}
