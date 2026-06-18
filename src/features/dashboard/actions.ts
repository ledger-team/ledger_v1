'use server'

import { requireUser } from '@/lib/auth/session'
import { logger } from '@/lib/log/logger'
import { EVENTS } from '@/lib/analytics/events'

export type StudyGuideResult = { ok: boolean; message: string; content?: string }

/**
 * Phase 0 STUB. The button exists and the wiring is real; the body is a
 * placeholder.
 *
 * PHASE 1: replace ONLY the final return with the actual Claude generation
 * (fetch the assignment, build the prompt, call the model, persist a
 * StudyGuide row, return { ok: true, content }). The signature and
 * StudyGuideResult shape stay identical, so StudyGuideButton needs no change.
 */
export async function generateStudyGuide(assignmentId: string): Promise<StudyGuideResult> {
  const session = await requireUser()
  logger.info(
    { event: EVENTS.dashboard.study_guide_requested, userId: session.user.id, assignmentId },
    'study guide requested',
  )

  return { ok: false, message: 'Study guide coming in Phase 1' }
}
