// Dev-only smoke test for the `withApi` wrapper. Returns 404 in production so
// it's not an attack surface there.
//
// It exercises the wrapper end-to-end in dev: rate limiting is live (hammer it
// to see a 429). It is declared `public: true` because there is no auth system
// until Milestone E — the 401 and 400 paths are covered by withApi.test.ts.

import { NextResponse, type NextRequest } from 'next/server'
import { withApi } from '@/lib/api/withApi'

const handler = withApi({ public: true, rateLimit: 'api' }, async () =>
  NextResponse.json({ ok: true, wrapper: 'withApi', rateLimit: 'api' }),
)

export async function GET(req: NextRequest): Promise<Response> {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse(null, { status: 404 })
  }
  return handler(req)
}
