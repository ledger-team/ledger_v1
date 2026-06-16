'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { audit } from '@/lib/audit/audit'
import { EVENTS } from '@/lib/analytics/events'

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

  redirect('/dashboard')
}
