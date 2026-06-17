'use client'

import { signOut } from 'next-auth/react'

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="flex h-11 w-full items-center justify-center rounded-lg border border-surface px-4 text-sm font-medium text-foreground transition-transform active:scale-[0.97] hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      Sign out
    </button>
  )
}
