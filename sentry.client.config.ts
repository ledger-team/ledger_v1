// Browser-side Sentry init. Loaded by the Next runtime when the app boots
// in the browser (no explicit import needed — Next picks it up by filename).
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Replay disabled in Phase 0 — no UI worth replaying yet. Add when feature work begins.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
})
