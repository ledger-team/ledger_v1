'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_ITEMS, isActive } from './nav'
import { ThemeToggle } from './ThemeToggle'
import { Avatar } from './Avatar'
import { HomeIcon, FeedIcon, StudyIcon, YouIcon } from './icons'

const ICON: Record<string, (p: { className?: string }) => React.ReactNode> = {
  '/home': HomeIcon,
  '/feed': FeedIcon,
  '/study': StudyIcon,
  '/you': YouIcon,
}

export function AppNav({ userName }: { userName: string | null }) {
  const pathname = usePathname()

  return (
    <>
      {/* Desktop: left sidebar */}
      <nav
        aria-label="Primary"
        className="hidden border-surface bg-background md:fixed md:inset-y-0 md:left-0 md:flex md:w-56 md:flex-col md:border-r md:p-4"
      >
        <span className="px-2 text-2xl font-bold tracking-tight text-accent">ledger</span>
        <ul className="mt-6 flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = ICON[item.href]!
            const active = isActive(pathname, item.href)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors active:scale-[0.97] ${
                    active ? 'bg-accent/10 text-accent' : 'text-muted hover:text-foreground'
                  }`}
                >
                  <span className="h-5 w-5">
                    <Icon />
                  </span>
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
        <div className="flex items-center justify-between border-t border-surface pt-3">
          <Avatar name={userName} />
          <ThemeToggle />
        </div>
      </nav>

      {/* Mobile: fixed bottom tab bar (the one legitimate fixed element) */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-10 flex border-t border-surface bg-surface-raised md:hidden"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = ICON[item.href]!
          const active = isActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium transition-colors active:scale-[0.97] ${
                active ? 'text-accent' : 'text-muted'
              }`}
            >
              <span
                className={`h-6 w-6 ${active ? 'drop-shadow-[0_0_6px_rgba(181,255,61,0.55)]' : ''}`}
              >
                <Icon />
              </span>
              {item.label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
