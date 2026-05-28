// Dev-only smoke test for Pino logging (and, when configured, Better Stack).
// Returns 404 in production so it's not an attack surface there.

import { NextResponse } from 'next/server'
import { logger } from '@/lib/log/logger'
import { EVENTS } from '@/lib/analytics/events'

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse(null, { status: 404 })
  }
  logger.info({ event: EVENTS.smoke.logger }, 'smoke logger — info line')
  logger.warn({ event: EVENTS.smoke.logger }, 'smoke logger — warn line')
  logger.error({ event: EVENTS.smoke.logger }, 'smoke logger — error line')
  return NextResponse.json({ ok: true, event: EVENTS.smoke.logger })
}
