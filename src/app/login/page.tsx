'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { BrandMark } from '@/components/BrandMark'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError('')
    const res = await signIn('email', { email, redirect: false, callbackUrl: '/home' })
    setPending(false)
    if (res?.error) {
      setError('Could not send the link. Check the address and try again.')
    } else {
      // Pass the address along so the next screen can name it back to them.
      router.push(`/login/check-email?to=${encodeURIComponent(email)}`)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6 py-12">
      <Link href="/" className="mb-10 self-start">
        <BrandMark size="sm" />
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight">Sign in to Ledger</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Enter your email and we&apos;ll send you a link. No password to make up or forget. If you
        haven&apos;t used Ledger before, this creates your account.
      </p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@gmail.com"
            className="h-12 rounded-lg border border-foreground/15 bg-surface px-3.5 text-sm outline-none placeholder:text-muted focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>

        <button
          type="submit"
          disabled={pending || !email}
          className="flex h-12 items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-black transition-transform hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {pending ? 'Sending…' : 'Email me a link'}
        </button>

        {error && (
          <p role="alert" className="text-sm text-urgent">
            {error}
          </p>
        )}
      </form>

      <p className="mt-10 text-xs leading-relaxed text-muted">
        By signing in you agree that Ledger stores the data described in{' '}
        <Link href="/privacy" className="text-accent hover:underline">
          how your data is handled
        </Link>
        .
      </p>
    </main>
  )
}
