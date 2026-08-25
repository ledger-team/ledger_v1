// The Ledger mark: lime rounded square with a black L, optionally followed by
// the wordmark. Server-safe (no client hooks) so it can render anywhere.

const SIZES = {
  sm: { box: 'h-7 w-7 rounded-lg text-sm', word: 'text-sm' },
  md: { box: 'h-9 w-9 rounded-xl text-base', word: 'text-base' },
  lg: { box: 'h-12 w-12 rounded-xl text-xl', word: 'text-xl' },
} as const

export function BrandMark({
  size = 'sm',
  withWordmark = true,
  className = '',
}: {
  size?: keyof typeof SIZES
  withWordmark?: boolean
  className?: string
}) {
  const s = SIZES[size]
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        aria-hidden
        className={`flex items-center justify-center bg-accent font-bold text-black ${s.box}`}
      >
        L
      </span>
      {withWordmark && (
        <span className={`font-semibold tracking-tight text-accent ${s.word}`}>Ledger</span>
      )}
      <span className="sr-only">Ledger</span>
    </span>
  )
}
