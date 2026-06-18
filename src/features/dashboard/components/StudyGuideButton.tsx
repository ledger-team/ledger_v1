'use client'

import { useState, useTransition } from 'react'
import { generateStudyGuide, type StudyGuideResult } from '../actions'

export function StudyGuideButton({ assignmentId }: { assignmentId: string }) {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<StudyGuideResult | null>(null)

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => setResult(await generateStudyGuide(assignmentId)))
        }
        className={`flex h-11 w-full items-center justify-center rounded-lg border border-accent/40 px-4 text-sm font-medium text-accent transition-transform hover:bg-accent/10 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60 ${
          pending ? 'animate-pulse motion-reduce:animate-none' : ''
        }`}
      >
        {pending ? 'Generating…' : 'Generate study guide'}
      </button>
      {result && <p className="mt-2 text-sm text-muted">{result.message}</p>}
    </div>
  )
}
