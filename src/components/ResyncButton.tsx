'use client'

import { useState, useTransition } from 'react'
import { resyncCanvas, type ResyncResult } from '@/features/canvas-sync/actions'

export function ResyncButton() {
  const [result, setResult] = useState<ResyncResult | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setResult(null)
            setResult(await resyncCanvas())
          })
        }
        className="flex h-12 items-center justify-center rounded-2xl border border-foreground/15 px-4 text-sm font-medium hover:bg-surface disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {pending ? 'Syncing your courses…' : 'Sync Canvas now'}
      </button>

      {pending && (
        <p className="text-xs text-muted">This takes about 30 seconds. Leave the tab open.</p>
      )}

      {result && !pending && (
        <p role="status" className={`text-xs ${result.ok ? 'text-muted' : 'text-urgent'}`}>
          {result.message}
        </p>
      )}
    </div>
  )
}
