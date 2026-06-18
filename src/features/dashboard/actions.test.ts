import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/session', () => ({ requireUser: vi.fn() }))

import { generateStudyGuide } from './actions'
import { requireUser } from '@/lib/auth/session'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireUser).mockResolvedValue({ user: { id: 'u1', email: 'sam@ledger.dev' } } as never)
})

describe('generateStudyGuide (Phase 0 stub)', () => {
  it('requires a user and returns the Phase 1 placeholder', async () => {
    const res = await generateStudyGuide('assignment-1')
    expect(requireUser).toHaveBeenCalled()
    expect(res).toEqual({ ok: false, message: 'Study guide coming in Phase 1' })
  })
})
