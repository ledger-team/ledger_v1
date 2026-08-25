'use client'

import { useState, useTransition } from 'react'
import { addNote, deleteNote, toggleNote } from '../actions'

type Note = { id: string; body: string; done: boolean; position: number }

export function Notes({ assignmentId, notes }: { assignmentId: string; notes: Note[] }) {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const body = draft.trim()
    if (!body) return
    setError('')
    startTransition(async () => {
      const res = await addNote(assignmentId, body)
      if (res.ok) setDraft('')
      else setError(res.error ?? 'Could not save that.')
    })
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold tracking-tight">Your notes</h2>
        <p className="mt-0.5 text-xs text-muted">
          Only you can see these. Break the work into steps, or keep whatever you need.
        </p>
      </div>

      {notes.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {notes.map((n) => (
            <li
              key={n.id}
              className="group flex items-start gap-3 rounded-lg border border-foreground/10 bg-surface px-3 py-2.5"
            >
              <button
                type="button"
                aria-label={n.done ? 'Mark as not done' : 'Mark as done'}
                onClick={() => startTransition(() => void toggleNote(n.id, assignmentId))}
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[0.6rem] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  n.done ? 'border-accent bg-accent text-black' : 'border-foreground/30'
                }`}
              >
                {n.done ? '✓' : ''}
              </button>
              <span className={`min-w-0 flex-1 text-sm ${n.done ? 'text-muted line-through' : ''}`}>
                {n.body}
              </span>
              <button
                type="button"
                aria-label="Delete note"
                onClick={() => startTransition(() => void deleteNote(n.id, assignmentId))}
                className="shrink-0 text-xs text-muted opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={500}
          placeholder="Add a step or a note…"
          className="h-11 flex-1 rounded-lg border border-foreground/15 bg-surface px-3 text-sm outline-none placeholder:text-muted focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent"
        />
        <button
          type="submit"
          disabled={pending || draft.trim() === ''}
          className="h-11 shrink-0 rounded-lg bg-accent px-4 text-sm font-semibold text-black disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Add
        </button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-urgent">
          {error}
        </p>
      )}
    </section>
  )
}
