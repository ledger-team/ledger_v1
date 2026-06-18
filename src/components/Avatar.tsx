export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return parts
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
}

export function Avatar({ name, className }: { name: string | null; className?: string }) {
  return (
    <div
      aria-hidden
      className={`flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent ${className ?? ''}`}
    >
      {initialsOf(name)}
    </div>
  )
}
