'use client'

import { useState } from 'react'

// Stub. Real FERPA delete (deleteUserCompletely + confirmation flow) is Milestone H.
export function DeleteAccountButton() {
  const [clicked, setClicked] = useState(false)
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setClicked(true)}
        className="flex h-11 w-full items-center justify-center rounded-lg border border-urgent/40 px-4 text-sm font-medium text-urgent transition-transform active:scale-[0.97] hover:bg-urgent/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-urgent"
      >
        Delete account
      </button>
      {clicked && (
        <p className="text-xs text-muted">
          Account deletion arrives in a future update — not available yet.
        </p>
      )}
    </div>
  )
}
