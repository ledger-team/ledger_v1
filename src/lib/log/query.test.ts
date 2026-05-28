import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db/prisma'
import { NotImplementedInPhase0, queryAll } from './query'

describe('queryAll', () => {
  const createdIds: string[] = []
  let founderId: string

  beforeAll(async () => {
    const founder = await prisma.user.findUnique({
      where: { email: 'test-founder@ledger.test' },
    })
    if (!founder) throw new Error('Test user missing — run `pnpm db:seed`')
    founderId = founder.id

    // Defensive cleanup of orphans from prior crashed runs.
    await prisma.auditLog.deleteMany({
      where: { action: { startsWith: 'queryall.test.' } },
    })

    // Seed two distinct audit rows for the test.
    const a = await prisma.auditLog.create({
      data: { action: 'queryall.test.alpha', actorUserId: founderId },
    })
    const b = await prisma.auditLog.create({
      data: { action: 'queryall.test.beta', actorUserId: founderId },
    })
    createdIds.push(a.id, b.id)
  })

  afterAll(async () => {
    if (createdIds.length) {
      await prisma.auditLog.deleteMany({ where: { id: { in: createdIds } } })
    }
    await prisma.auditLog.deleteMany({
      where: { action: { startsWith: 'queryall.test.' } },
    })
    await prisma.$disconnect()
  })

  it('audit source: returns filtered rows ordered desc by createdAt', async () => {
    const rows = await queryAll({
      source: 'audit',
      filter: { actorUserId: founderId, action: 'queryall.test.alpha' },
    })
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r) => r.action === 'queryall.test.alpha')).toBe(true)
  })

  it('audit source: respects limit', async () => {
    const rows = await queryAll({
      source: 'audit',
      filter: { actorUserId: founderId },
      limit: 1,
    })
    expect(rows.length).toBeLessThanOrEqual(1)
  })

  it.each(['sentry', 'posthog', 'logs'] as const)(
    '%s source throws NotImplementedInPhase0',
    async (source) => {
      await expect(queryAll({ source })).rejects.toBeInstanceOf(NotImplementedInPhase0)
    },
  )
})
