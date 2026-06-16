'use client'

import { signOut } from 'next-auth/react'

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium"
    >
      Sign out
    </button>
  )
}
