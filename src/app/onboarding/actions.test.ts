import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Unit test of the onboarding action's logic. Session, DB, and audit are mocked,
// so it runs without a live Supabase (the real persistence path is exercised
// manually / in the integration runbook).
vi.mock('@/lib/auth/session', () => ({ requireUser: vi.fn() }))
vi.mock('@/lib/db/prisma', () => ({
  prisma: { school: { findFirst: vi.fn() }, user: { update: vi.fn() } },
}))
vi.mock('@/lib/audit/audit', () => ({ audit: { log: vi.fn() } }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

import { completeOnboarding } from './actions'
import { requireUser } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { audit } from '@/lib/audit/audit'

const mockedRequireUser = vi.mocked(requireUser)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockedPrisma = prisma as any

function form(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

beforeEach(() => {
  mockedRequireUser.mockResolvedValue({ user: { id: 'u1', email: 'sam@ledger.dev' } } as never)
})
afterEach(() => vi.clearAllMocks())

describe('completeOnboarding', () => {
  it('returns an error and does not write when required fields are missing', async () => {
    const res = await completeOnboarding({}, form({ schoolId: 's1', gradYear: '2027' })) // no name
    expect(res.error).toBeTruthy()
    expect(mockedPrisma.user.update).not.toHaveBeenCalled()
  })

  it('rejects an unknown / inactive school', async () => {
    mockedPrisma.school.findFirst.mockResolvedValue(null)
    const res = await completeOnboarding({}, form({ name: 'Sam', schoolId: 'nope', gradYear: '2027' }))
    expect(res.error).toBeTruthy()
    expect(mockedPrisma.user.update).not.toHaveBeenCalled()
  })

  it('persists, audits, and redirects to /home on success', async () => {
    mockedPrisma.school.findFirst.mockResolvedValue({ id: 's1' })
    mockedPrisma.user.update.mockResolvedValue({})

    await expect(
      completeOnboarding({}, form({ name: 'Sam Berry', schoolId: 's1', gradYear: '2027' })),
    ).rejects.toThrow('REDIRECT:/home')

    expect(mockedPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({ name: 'Sam Berry', schoolId: 's1', gradYear: 2027 }),
      }),
    )
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'onboarding.completed', actorUserId: 'u1' }),
    )
  })
})
