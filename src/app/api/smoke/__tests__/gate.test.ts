// Smoke routes must return 404 in production. This test proves that — a
// gated route is only as good as the test asserting the gate fires.
//
// We import the route handlers directly and assert on the Response object.
// (We do NOT exercise the development path here: it would fire real Sentry /
// PostHog events. That path is covered by the manual runbook check.)

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('smoke routes return 404 in production', () => {
  it('GET /api/smoke/sentry returns 404 when NODE_ENV=production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const { GET } = await import('@/app/api/smoke/sentry/route')
    const res = await GET()
    expect(res.status).toBe(404)
  })

  it('GET /api/smoke/posthog returns 404 when NODE_ENV=production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const { GET } = await import('@/app/api/smoke/posthog/route')
    const res = await GET()
    expect(res.status).toBe(404)
  })

  it('GET /api/smoke/logger returns 404 when NODE_ENV=production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const { GET } = await import('@/app/api/smoke/logger/route')
    const res = await GET()
    expect(res.status).toBe(404)
  })

  // Longer timeout than the other three on purpose. This is the only smoke route
  // that imports `withApi`, which pulls in the auth chain, Prisma, and Upstash.
  // Worse, stubbing NODE_ENV=production above skips the `globalForPrisma` cache
  // branch in src/lib/db/prisma.ts, so the import builds a fresh PrismaClient and
  // loads the query engine from scratch instead of reusing the shared one. That
  // is a cold start of several seconds on some machines. The route itself still
  // short-circuits to 404 immediately; only the module load is slow.
  it(
    'GET /api/smoke/protected returns 404 when NODE_ENV=production',
    async () => {
      vi.stubEnv('NODE_ENV', 'production')
      const { GET } = await import('@/app/api/smoke/protected/route')
      // The production gate short-circuits before touching the request, so a bare
      // Request stands in for the NextRequest the framework would normally pass.
      const res = await GET(new Request('http://localhost/api/smoke/protected') as NextRequest)
      expect(res.status).toBe(404)
    },
    20_000,
  )
})
