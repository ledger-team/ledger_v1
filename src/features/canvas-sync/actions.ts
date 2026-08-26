'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth/session'
import { limit } from '@/lib/rate-limit/limiter'
import { logger } from '@/lib/log/logger'
import { EVENTS } from '@/lib/analytics/events'
import { syncUserCanvas, type SyncStatus } from './sync'

// Manual re-sync, from the You tab.
//
// Before this existed, syncUserCanvas ran exactly once — during onboarding — so a
// student's Canvas data was frozen at signup forever and GradeSnapshot could
// never collect a second reading. The nightly cron (src/app/api/cron/sync) is the
// background half; this is the "I just got a grade back, show me now" half.
//
// Rate limited hard: a sync is 4+ Canvas API calls per course plus a write per
// assignment. Canvas throttles aggressively, and a student holding down a button
// would burn their own token's quota.
const RESYNC_LIMIT = { limit: 4, windowSeconds: 3600 }

export type ResyncResult = { ok: boolean; message: string }

const MESSAGES: Record<SyncStatus, { ok: boolean; message: string }> = {
  ok: { ok: true, message: 'Synced.' },
  partial: {
    ok: true,
    message: 'Partly synced. Some assignments may be missing — try again in a bit.',
  },
  auth_error: {
    ok: false,
    message: 'Canvas rejected your token. It was probably deleted or expired — reconnect Canvas.',
  },
  unavailable: { ok: false, message: 'Canvas is not responding. Try again later.' },
  no_token: { ok: false, message: 'No Canvas token saved yet.' },
  error: { ok: false, message: 'Sync failed. It has been logged and I will look at it.' },
}

export async function resyncCanvas(): Promise<ResyncResult> {
  const session = await requireUser()

  const gate = await limit(`resync:${session.user.id}`, RESYNC_LIMIT)
  if (!gate.success) {
    const minutes = Math.max(1, Math.ceil((gate.reset - Date.now()) / 60_000))
    return {
      ok: false,
      message: `You've synced a few times already. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    }
  }

  const result = await syncUserCanvas(session.user.id)
  logger.info(
    { event: EVENTS.canvas.resync_requested, userId: session.user.id, status: result.status },
    'manual resync',
  )

  revalidatePath('/you')
  revalidatePath('/home')
  revalidatePath('/study')
  return MESSAGES[result.status]
}
