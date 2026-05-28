'use client'

// Top-level error boundary for the App Router. Reports React rendering errors
// to Sentry that the framework can't otherwise catch.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/#react-render-errors-in-app-router

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body>
        <main className="flex min-h-screen items-center justify-center px-6">
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Something went wrong.</h1>
            <p className="mt-2 text-sm text-neutral-400">
              We&apos;ve been notified. Try again in a moment.
            </p>
          </div>
        </main>
      </body>
    </html>
  )
}
