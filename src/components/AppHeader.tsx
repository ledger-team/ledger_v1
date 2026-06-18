import { ThemeToggle } from './ThemeToggle'
import { Avatar } from './Avatar'

// Mobile-only top bar (normal flow, not fixed). On desktop the wordmark + toggle
// + avatar live in the sidebar, so this is hidden.
export function AppHeader({ userName }: { userName: string | null }) {
  return (
    <header className="flex items-center justify-between px-4 pt-3 md:hidden">
      <span className="text-xl font-bold tracking-tight text-accent">ledger</span>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <Avatar name={userName} />
      </div>
    </header>
  )
}
