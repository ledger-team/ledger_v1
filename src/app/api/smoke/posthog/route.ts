// Dev-only smoke test for PostHog ingestion.
// Returns 404 in production so it's not an attack surface there.

import { NextResponse } from 'next/server'
import { captureServer } from '@/lib/analytics/posthog.server'
import { EVENTS } from '@/lib/analytics/events'

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse(null, { status: 404 })
  }
  await captureServer({
    event: EVENTS.smoke.posthog,
    distinctId: 'smoke-user',
    properties: { now: Date.now(), source: 'api/_smoke/posthog' },
  })
  return NextResponse.json({ ok: true, event: EVENTS.smoke.posthog })
}
