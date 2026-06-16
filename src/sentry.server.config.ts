// Server-side Sentry init. Loaded by instrumentation.ts on Node-runtime boot.
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  // Trace 10% in production, every event in dev so we can verify wiring.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  // Source maps disabled in Phase 0 per Decision 1.1. Wired in Milestone J.
  // The DSN being missing is fine in unit tests; only warn in dev/prod.
  enabled: !!process.env.SENTRY_DSN,
})
