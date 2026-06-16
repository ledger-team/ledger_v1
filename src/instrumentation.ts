// Next 15 instrumentation hook. Loads the right Sentry config per runtime.
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

// Re-exported so @sentry/nextjs can hook React Server Component errors.
export { captureRequestError as onRequestError } from '@sentry/nextjs'
