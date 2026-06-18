// Integration test (requires Supabase). Exercises the real FK cascade + AuditLog
// SET NULL against the live DB.

import { afterAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db/prisma'
import { deleteUserCompletely } from './deleteUserCompletely'

describe('deleteUserCompletely (integration; requires seeded Supabase)', () => {
  const createdUserIds: string[] = []

  afterAll(async () => {
    // The audit rows survive the user (SET NULL) — clean up the ones we made.
    await prisma.auditLog.deleteMany({
      where: { action: 'user.deleted', targetId: { in: createdUserIds } },
    })
    await prisma.$disconnect()
  }, 30_000)

  it('removes the user + cascades and preserves an audit row with actorUserId null', async () => {
    const school = await prisma.school.findFirst({ select: { id: true } })
    const user = await prisma.user.create({
      data: {
        email: `test-del-${Date.now()}@ledger.test`,
        name: 'Delete Me',
        schoolId: school?.id ?? null,
        canvasToken: { create: { encryptedToken: 'v2:integration-test' } },
      },
      select: { id: true },
    })
    createdUserIds.push(user.id)

    const res = await deleteUserCompletely(user.id)
    expect(res).toEqual({ deleted: true })

    // User + cascaded child gone.
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull()
    expect(await prisma.canvasToken.findUnique({ where: { userId: user.id } })).toBeNull()

    // Audit row retained, actorUserId SET NULL, actorEmailHash preserved.
    const auditRow = await prisma.auditLog.findFirst({
      where: { action: 'user.deleted', targetId: user.id },
    })
    expect(auditRow).not.toBeNull()
    expect(auditRow?.actorUserId).toBeNull()
    expect(auditRow?.actorEmailHash).toBeTruthy()

    // Idempotent: a second call is a no-op.
    expect(await deleteUserCompletely(user.id)).toEqual({ deleted: false })
  }, 30_000) // generous timeout: integration tests share a connection_limit=1 pooler
})
