'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/session'
import { canPasteCanvasToken } from '@/lib/auth/inviteAllowlist'
import { prisma } from '@/lib/db/prisma'
import { audit } from '@/lib/audit/audit'
import { logger } from '@/lib/log/logger'
import { EVENTS } from '@/lib/analytics/events'
import { saveToken } from '@/features/canvas-sync/token'
import { syncUserCanvas } from '@/features/canvas-sync/sync'

export type OnboardingState = { error?: string }

const nextYear = new Date().getFullYear() + 1
const OnboardingSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(100),
  schoolId: z.string().min(1, 'Select your school'),
  gradYear: z.coerce
    .number()
    .int()
    .min(nextYear - 1, 'Enter a valid graduation year')
    .max(nextYear + 6, 'Enter a valid graduation year'),
})

// useActionState-compatible: (prevState, formData) => state. On success it
// redirects (which throws NEXT_REDIRECT) so no state is returned; on failure it
// returns an error message for the form to render.
export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const session = await requireUser()

  const parsed = OnboardingSchema.safeParse({
    name: formData.get('name'),
    schoolId: formData.get('schoolId'),
    gradYear: formData.get('gradYear'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please fill in all fields.' }
  }

  const school = await prisma.school.findFirst({
    where: { id: parsed.data.schoolId, isActive: true },
    select: { id: true },
  })
  if (!school) return { error: 'That school is not available.' }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name: parsed.data.name, schoolId: parsed.data.schoolId, gradYear: parsed.data.gradYear },
  })

  await audit.log({
    action: EVENTS.onboarding.completed,
    actorUserId: session.user.id,
    schoolId: parsed.data.schoolId,
    metadata: { gradYear: parsed.data.gradYear },
  })

  // Optional Canvas connect (gated by the invite allowlist). Onboarding has
  // already completed above, so any Canvas failure surfaces as a /home banner
  // rather than blocking the user (Decision F5). Sync runs inline (F4).
  const rawToken = formData.get('canvasToken')
  const canvasToken = typeof rawToken === 'string' ? rawToken.trim() : ''
  let syncStatus: string | null = null
  if (canvasToken && canPasteCanvasToken(session.user.email)) {
    try {
      await saveToken(session.user.id, canvasToken)
      syncStatus = (await syncUserCanvas(session.user.id)).status
    } catch (err) {
      logger.error(
        { event: EVENTS.canvas.sync_failed, userId: session.user.id, err: String(err) },
        'canvas connect during onboarding threw',
      )
      syncStatus = 'error'
    }
  }

  redirect(syncStatus ? `/home?sync=${syncStatus}` : '/home')
}
