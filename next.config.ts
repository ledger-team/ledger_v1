import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
  reactStrictMode: true,
}

export default withSentryConfig(nextConfig, {
  // Suppress Sentry build-time chatter — we want errors visible but not chatter.
  silent: true,
  // Source map upload deferred to Milestone J (production cutover). In dev
  // we have the TypeScript open; in Phase 0 prod doesn't exist yet.
  sourcemaps: { disable: true },
  // Other Sentry features (release notes, deploy markers, etc.) wire up in J.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Hide the source-map upload warning when org/project/token are missing.
  disableLogger: true,
})
