import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db/prisma'
import { audit, hashEmail } from './audit'

describe('audit.hashEmail', () => {
  it('produces the same hash for the same email regardless of case/whitespace', () => {
    const a = hashEmail('Test-Founder@ledger.test')
    const b = hashEmail('  test-founder@ledger.test  ')
    expect(a).toBe(b)
    expect(a).toHaveLength(64) // SHA-256 hex
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })

  it('produces different hashes for different emails', () => {
    expect(hashEmail('a@example.com')).not.toBe(hashEmail('b@example.com'))
  })
})

describe('audit.log (integration; requires seeded Supabase)', () => {
  let founderId: string
  const createdIds: string[] = []

  beforeAll(async () => {
    const founder = await prisma.user.findUnique({
      where: { email: 'test-founder@ledger.test' },
    })
    if (!founder) throw new Error('Test user missing — run `pnpm db:seed`')
    founderId = founder.id

    // Defensive cleanup of any orphaned rows from a prior crashed run.
    await prisma.auditLog.deleteMany({
      where: { action: { startsWith: 'audit.test.' } },
    })
  })

  afterAll(async () => {
    if (createdIds.length) {
      await prisma.auditLog.deleteMany({ where: { id: { in: createdIds } } })
    }
    await prisma.auditLog.deleteMany({
      where: { action: { startsWith: 'audit.test.' } },
    })
    await prisma.$disconnect()
  })

  it('writes a row with the expected shape including actorEmailHash', async () => {
    await audit.log({
      action: 'audit.test.basic',
      actorUserId: founderId,
      targetType: 'TestTarget',
      targetId: 'target-123',
      metadata: { foo: 'bar' },
    })

    const row = await prisma.auditLog.findFirst({
      where: { action: 'audit.test.basic', actorUserId: founderId },
      orderBy: { createdAt: 'desc' },
    })
    expect(row).not.toBeNull()
    createdIds.push(row!.id)

    expect(row).toMatchObject({
      action: 'audit.test.basic',
      actorUserId: founderId,
      targetType: 'TestTarget',
      targetId: 'target-123',
    })
    expect(row!.actorEmailHash).toBe(hashEmail('test-founder@ledger.test'))
    expect(row!.metadata).toEqual({ foo: 'bar' })
  })

  it('handles null actorUserId (system action) without crashing', async () => {
    await audit.log({ action: 'audit.test.system' })
    const row = await prisma.auditLog.findFirst({
      where: { action: 'audit.test.system' },
      orderBy: { createdAt: 'desc' },
    })
    expect(row).not.toBeNull()
    createdIds.push(row!.id)
    expect(row!.actorUserId).toBeNull()
    expect(row!.actorEmailHash).toBeNull()
  })

  it('fails open: DB error does not propagate to caller', async () => {
    // Force the Prisma client's create to throw.
    const spy = vi
      .spyOn(prisma.auditLog, 'create')
      .mockRejectedValueOnce(new Error('simulated DB failure'))

    // Should not throw — fail-open per Phase 0 plan § 5.
    await expect(audit.log({ action: 'audit.test.fail-open' })).resolves.toBeUndefined()

    spy.mockRestore()
  })
})
