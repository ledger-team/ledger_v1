'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'

// Dark mode is primary. attribute="class" pairs with the @custom-variant dark
// in globals.css; next-themes injects a pre-hydration script (hence
// suppressHydrationWarning on <html> in the root layout).
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      {children}
    </NextThemesProvider>
  )
}
