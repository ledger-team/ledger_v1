// Integration test (requires seeded Supabase). Proves dashboard reads are
// isolated per user THROUGH withSession/RLS: a user in the same school but with
// no enrollments sees zero courses/assignments, while the seeded founder (who is
// enrolled) sees theirs.

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db/prisma'
import type { AppSession } from '@/lib/auth/session'
import { getDashboardData } from './queries'

function sessionFor(id: string, schoolId: string): AppSession {
  return { user: { id, email: `${id}@ledger.test`, name: 'Test', schoolId, gradYear: 2027, onboarded: true } }
}

describe('getDashboardData (integration; requires seeded Supabase)', () => {
  let founderId: string
  let schoolId: string
  let lonerId: string | null = null

  beforeAll(async () => {
    const founder = await prisma.user.findUnique({ where: { email: 'test-founder@ledger.test' } })
    if (!founder?.schoolId) {
      throw new Error('Prerequisites missing. Run `pnpm db:seed`.')
    }
    founderId = founder.id
    schoolId = founder.schoolId

    // Same school, but never enrolled in anything.
    const loner = await prisma.user.create({
      data: {
        email: `test-dash-loner-${Date.now()}@ledger.test`,
        name: 'Dashboard Loner',
        schoolId,
        gradYear: 2027,
      },
      select: { id: true },
    })
    lonerId = loner.id
  })

  afterAll(async () => {
    if (lonerId) await prisma.user.delete({ where: { id: lonerId } })
    await prisma.$disconnect()
  })

  it('founder sees their enrolled courses', async () => {
    const data = await getDashboardData(sessionFor(founderId, schoolId))
    expect(data.courses.length).toBeGreaterThan(0)
  })

  it('a no-enrollment user in the same school sees nothing (RLS isolation)', async () => {
    const data = await getDashboardData(sessionFor(lonerId!, schoolId))
    expect(data.courses).toHaveLength(0)
    expect(data.assignments).toHaveLength(0)
  })
})
