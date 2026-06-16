'use client'

// Browser-side PostHog provider. Mount at the root layout. Initializes the
// posthog-js client once on first render. No-op if NEXT_PUBLIC_POSTHOG_KEY
// is missing — useful for local-only dev without analytics.

import posthog from 'posthog-js'
import { PostHogProvider as Provider } from 'posthog-js/react'
import { useEffect } from 'react'

let initialized = false

function init() {
  if (initialized) return
  if (typeof window === 'undefined') return
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: true,
    capture_pageleave: true,
  })
  initialized = true
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    init()
  }, [])
  return <Provider client={posthog}>{children}</Provider>
}
