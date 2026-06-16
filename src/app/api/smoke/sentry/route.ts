// Dev-only smoke test for Sentry ingestion.
// Returns 404 in production so it's not an attack surface there.

import { NextResponse } from 'next/server'

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse(null, { status: 404 })
  }
  throw new Error('smoke: sentry test (intentional — Phase 0 / Milestone C wiring check)')
}
