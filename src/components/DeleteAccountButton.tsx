'use client'

import { useRef, useTransition } from 'react'
import { signOut } from 'next-auth/react'
import { deleteAccount } from '@/app/(app)/you/actions'

// Native <dialog> via showModal(): Escape cancels and focus is trapped for free.
// Cancel is the default focus (H4) — Enter on the dialog dismisses, never deletes;
// reaching Delete takes a deliberate Tab/click.
export function DeleteAccountButton() {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [pending, startTransition] = useTransition()

  function confirmDelete() {
    startTransition(async () => {
      await deleteAccount()
      await signOut({ callbackUrl: '/login' })
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="flex h-11 w-full items-center justify-center rounded-lg border border-urgent/40 px-4 text-sm font-medium text-urgent transition-transform hover:bg-urgent/10 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-urgent"
      >
        Delete account
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="delete-account-title"
        className="m-auto w-[min(90vw,22rem)] rounded-2xl bg-surface p-5 text-foreground backdrop:bg-black/50"
      >
        <h2 id="delete-account-title" className="text-base font-medium">
          Delete account?
        </h2>
        <p className="mt-2 text-sm text-muted">
          This permanently deletes your account and all your data. This cannot be undone.
        </p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            autoFocus
            onClick={() => dialogRef.current?.close()}
            className="h-11 flex-1 rounded-lg border border-surface bg-surface-raised text-sm font-medium transition-transform active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={confirmDelete}
            className="h-11 flex-1 rounded-lg bg-urgent text-sm font-medium text-white transition-transform active:scale-[0.97] disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-urgent"
          >
            {pending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </dialog>
    </div>
  )
}
