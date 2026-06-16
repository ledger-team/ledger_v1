import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

// HTTP security headers (Phase 0 plan §D.4). Applied to every route.
//
// CSP is env-aware: dev needs 'unsafe-eval'/'unsafe-inline' for Next's HMR
// runtime. Prod drops 'unsafe-eval'. 'unsafe-inline' stays on script-src for
// now because Next injects inline bootstrap scripts without a nonce — tightening
// this to a nonce-based policy is a follow-up as real pages land in E–G.
// connect-src allowlists Sentry ingest and PostHog so the browser SDKs can POST.
const isProd = process.env.NODE_ENV === 'production'

const contentSecurityPolicy = [
  `default-src 'self'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
  `object-src 'none'`,
  `img-src 'self' data: blob:`,
  `font-src 'self'`,
  `style-src 'self' 'unsafe-inline'`,
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"}`,
  `connect-src 'self' https://*.ingest.us.sentry.io https://us.i.posthog.com https://us-assets.i.posthog.com`,
]
  .join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
]

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
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
