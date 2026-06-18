import { ThemeToggle } from './ThemeToggle'
import { SignOutButton } from './SignOutButton'
import { DeleteAccountButton } from './DeleteAccountButton'
import { Avatar } from './Avatar'

export type YouViewProps = {
  name: string | null
  email: string | null
  schoolName: string | null
  canvasConnected: boolean
  lastSyncedAt: Date | null
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d)
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3">
      <span className="text-sm text-muted">{label}</span>
      <span className={`text-sm font-medium ${valueClass ?? 'text-foreground'}`}>{value}</span>
    </div>
  )
}

export function YouView({ name, email, schoolName, canvasConnected, lastSyncedAt }: YouViewProps) {
  const canvasValue = canvasConnected
    ? lastSyncedAt
      ? `Connected · synced ${formatDate(lastSyncedAt)}`
      : 'Connected'
    : 'Not connected'

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-medium text-foreground">You</h1>

      <section className="flex items-center gap-3 rounded-2xl bg-surface p-4">
        <Avatar name={name} className="h-12 w-12 text-base" />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-medium text-foreground">{name ?? 'Student'}</p>
          {email && <p className="truncate text-xs text-muted">{email}</p>}
        </div>
      </section>

      <div className="flex flex-col gap-3">
        <Row label="School" value={schoolName ?? '—'} />
        <Row
          label="Canvas"
          value={canvasValue}
          valueClass={canvasConnected ? 'text-accent' : 'text-muted'}
        />
        <div className="flex items-center justify-between rounded-2xl bg-surface px-4 py-2">
          <span className="text-sm text-muted">Theme</span>
          <ThemeToggle />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <SignOutButton />
        <DeleteAccountButton />
      </div>
    </div>
  )
}
