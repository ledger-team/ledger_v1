import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(), delete: vi.fn() },
    verificationToken: { deleteMany: vi.fn() },
  },
}))
vi.mock('@/lib/audit/audit', () => ({ audit: { log: vi.fn() } }))

import { deleteUserCompletely } from './deleteUserCompletely'
import { prisma } from '@/lib/db/prisma'
import { audit } from '@/lib/audit/audit'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any

beforeEach(() => vi.clearAllMocks())

describe('deleteUserCompletely', () => {
  it('audits before deleting, and removes the user + verification tokens', async () => {
    p.user.findUnique.mockResolvedValue({ id: 'u1', email: 'sam@ledger.test', schoolId: 's1' })
    p.verificationToken.deleteMany.mockResolvedValue({ count: 1 })
    p.user.delete.mockResolvedValue({})

    const res = await deleteUserCompletely('u1')
    expect(res).toEqual({ deleted: true })

    // audit.log must run BEFORE prisma.user.delete (the user must still exist).
    const auditOrder = vi.mocked(audit.log).mock.invocationCallOrder[0]!
    const deleteOrder = p.user.delete.mock.invocationCallOrder[0]!
    expect(auditOrder).toBeLessThan(deleteOrder)

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user.deleted', actorUserId: 'u1', targetId: 'u1' }),
    )
    expect(p.verificationToken.deleteMany).toHaveBeenCalledWith({
      where: { identifier: 'sam@ledger.test' },
    })
    expect(p.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } })
  })

  it('is idempotent — a no-op when the user is already gone', async () => {
    p.user.findUnique.mockResolvedValue(null)

    const res = await deleteUserCompletely('ghost')
    expect(res).toEqual({ deleted: false })
    expect(audit.log).not.toHaveBeenCalled()
    expect(p.user.delete).not.toHaveBeenCalled()
    expect(p.verificationToken.deleteMany).not.toHaveBeenCalled()
  })
})
