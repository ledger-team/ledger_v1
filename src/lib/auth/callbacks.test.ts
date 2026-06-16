import { afterEach, describe, expect, it, vi } from 'vitest'

// Avoid real side effects from importing the config module.
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({ emails: { send: vi.fn() } })),
}))
vi.mock('@/lib/audit/audit', () => ({ audit: { log: vi.fn() } }))

import { authOptions } from './config'
import { audit } from '@/lib/audit/audit'
import { EVENTS } from '@/lib/analytics/events'

const sessionCb = authOptions.callbacks!.session!
const events = authOptions.events!

type MappedUser = {
  id: string
  schoolId: string | null
  gradYear: number | null
  onboarded: boolean
}
const userOf = (r: unknown) => (r as { user: MappedUser }).user

afterEach(() => vi.clearAllMocks())

describe('session callback', () => {
  it('maps the adapter user row onto session.user and marks onboarded', async () => {
    const result = await sessionCb({
      session: { user: { email: 'sam@ledger.dev', name: 'Sam' }, expires: '' },
      user: { id: 'u1', email: 'sam@ledger.dev', schoolId: 's1', gradYear: 2027 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    const user = userOf(result)
    expect(user.id).toBe('u1')
    expect(user.schoolId).toBe('s1')
    expect(user.gradYear).toBe(2027)
    expect(user.onboarded).toBe(true)
  })

  it('marks onboarded=false when schoolId is not set', async () => {
    const result = await sessionCb({
      session: { user: { email: 'new@ledger.dev' }, expires: '' },
      user: { id: 'u2', email: 'new@ledger.dev', schoolId: null, gradYear: null },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    expect(userOf(result).onboarded).toBe(false)
  })
})

describe('auth events write the audit trail', () => {
  it('signIn → auth.session.created', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await events.signIn!({ user: { id: 'u1' } } as any)
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: EVENTS.auth.session_created, actorUserId: 'u1' }),
    )
  })

  it('signOut → auth.session.revoked', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await events.signOut!({ session: { userId: 'u1' } } as any)
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: EVENTS.auth.session_revoked, actorUserId: 'u1' }),
    )
  })
})
