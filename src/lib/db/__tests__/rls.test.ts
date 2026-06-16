// Row Level Security isolation tests.
//
// Integration test. Hits the real Supabase project pointed at by .env's
// DATABASE_URL / DIRECT_URL. Requires the test users to be seeded
// (`pnpm db:seed`). Every AuditLog row this test writes uses ids prefixed
// `test-rls-` and actions prefixed `rls.test.` so they're identifiable;
// `beforeAll` defensively cleans up orphans from prior crashed runs and
// `afterAll` cleans up rows the current run created.
//
// This is the highest-value test in the foundation. It catches the failure
// mode that v1 had: app-layer filtering with no RLS underneath, so a missing
// `where:` clause leaked one user's data to another. If this test ever goes
// red, treat it as a security incident, not a flaky test.

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db/prisma'
import { withSession } from '@/lib/db/withSession'

const TEST_ID_PREFIX = 'test-rls-'
const TEST_ACTION_PREFIX = 'rls.test.'

describe('RLS isolation (integration; requires seeded Supabase)', () => {
  let founderId: string
  let classmateId: string
  let schoolId: string
  const createdAuditIds: string[] = []
  let counter = 0
  const testRunStart = Date.now()

  function newAuditId(): string {
    counter += 1
    return `${TEST_ID_PREFIX}${testRunStart}-${counter}`
  }

  async function cleanupTestRows(): Promise<void> {
    // Belt-and-suspenders: prefix-match AND action-match so escapees from a
    // partial run still get removed.
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { id: { startsWith: TEST_ID_PREFIX } },
          { action: { startsWith: TEST_ACTION_PREFIX } },
        ],
      },
    })
  }

  beforeAll(async () => {
    const founder = await prisma.user.findUnique({
      where: { email: 'test-founder@ledger.test' },
    })
    const classmate = await prisma.user.findUnique({
      where: { email: 'test-classmate@ledger.test' },
    })
    if (!founder || !classmate || !founder.schoolId) {
      throw new Error(
        'RLS test prerequisites missing. Run `pnpm db:seed` and ensure both ' +
          'test-founder@ledger.test and test-classmate@ledger.test exist.',
      )
    }
    founderId = founder.id
    classmateId = classmate.id
    schoolId = founder.schoolId

    // Defensive cleanup of any orphaned test rows from a prior crashed run.
    await cleanupTestRows()
  })

  afterAll(async () => {
    if (createdAuditIds.length) {
      await prisma.auditLog.deleteMany({ where: { id: { in: createdAuditIds } } })
    }
    await cleanupTestRows()
    await prisma.$disconnect()
  })

  // -----------------------------------------------------------------
  // User row isolation
  // -----------------------------------------------------------------
  describe('User isolation', () => {
    it('founder claims see only the founder row', async () => {
      await withSession({ user_id: founderId, school_id: schoolId }, async (tx) => {
        const users = await tx.user.findMany({ select: { id: true, email: true } })
        expect(users).toHaveLength(1)
        expect(users[0]?.id).toBe(founderId)
      })
    })

    it('classmate claims see only the classmate row', async () => {
      await withSession({ user_id: classmateId, school_id: schoolId }, async (tx) => {
        const users = await tx.user.findMany({ select: { id: true, email: true } })
        expect(users).toHaveLength(1)
        expect(users[0]?.id).toBe(classmateId)
      })
    })

    it('non-existent user_id sees zero rows (RLS does not trust JWT existence)', async () => {
      await withSession(
        { user_id: 'ghost-user-id-does-not-exist', school_id: schoolId },
        async (tx) => {
          const users = await tx.user.findMany()
          expect(users).toHaveLength(0)
          const enrollments = await tx.enrollment.findMany()
          expect(enrollments).toHaveLength(0)
          const courses = await tx.course.findMany()
          expect(courses).toHaveLength(0)
        },
      )
    })
  })

  // -----------------------------------------------------------------
  // Course / Assignment visibility via enrollment chain
  // -----------------------------------------------------------------
  describe('Course / Assignment visibility via enrollment', () => {
    it('founder sees the courses they are enrolled in (and only those)', async () => {
      await withSession({ user_id: founderId, school_id: schoolId }, async (tx) => {
        const courses = await tx.course.findMany({ select: { id: true } })
        const enrollments = await tx.enrollment.findMany({
          select: { sectionId: true },
        })
        const sectionsForUser = await tx.section.findMany({
          where: { id: { in: enrollments.map((e) => e.sectionId) } },
          select: { courseId: true },
        })
        const expectedCourseIds = new Set(sectionsForUser.map((s) => s.courseId))
        expect(new Set(courses.map((c) => c.id))).toEqual(expectedCourseIds)
      })
    })

    it('founder sees assignments via the enrollment chain', async () => {
      await withSession({ user_id: founderId, school_id: schoolId }, async (tx) => {
        const assignments = await tx.assignment.findMany({ select: { id: true } })
        expect(assignments.length).toBeGreaterThan(0)
      })
    })
  })

  // -----------------------------------------------------------------
  // AuditLog append-only enforcement
  // -----------------------------------------------------------------
  describe('AuditLog append-only enforcement', () => {
    it('inserting an audit row with own actorUserId succeeds', async () => {
      const id = newAuditId()
      await withSession({ user_id: founderId, school_id: schoolId }, async (tx) => {
        await tx.auditLog.create({
          data: {
            id,
            actorUserId: founderId,
            action: `${TEST_ACTION_PREFIX}legitimate`,
          },
        })
      })
      createdAuditIds.push(id)
      const row = await prisma.auditLog.findUnique({ where: { id } })
      expect(row).not.toBeNull()
      expect(row?.actorUserId).toBe(founderId)
    })

    it('inserting an audit row spoofing another userId is blocked by RLS', async () => {
      const id = newAuditId()
      await expect(
        withSession({ user_id: founderId, school_id: schoolId }, async (tx) => {
          await tx.auditLog.create({
            data: {
              id,
              actorUserId: classmateId, // spoof
              action: `${TEST_ACTION_PREFIX}spoof`,
            },
          })
        }),
      ).rejects.toThrow()

      // Confirm no row was created.
      const row = await prisma.auditLog.findUnique({ where: { id } })
      expect(row).toBeNull()
    })

    it('UPDATE on AuditLog is blocked entirely (grant revocation)', async () => {
      // Pre-create a legitimate row via service role.
      const legitId = newAuditId()
      await prisma.auditLog.create({
        data: {
          id: legitId,
          actorUserId: founderId,
          action: `${TEST_ACTION_PREFIX}pre-update`,
        },
      })
      createdAuditIds.push(legitId)

      await expect(
        withSession({ user_id: founderId, school_id: schoolId }, async (tx) => {
          await tx.auditLog.update({
            where: { id: legitId },
            data: { action: `${TEST_ACTION_PREFIX}tampered` },
          })
        }),
      ).rejects.toThrow()

      // Confirm the row is unchanged.
      const row = await prisma.auditLog.findUnique({ where: { id: legitId } })
      expect(row?.action).toBe(`${TEST_ACTION_PREFIX}pre-update`)
    })

    it('DELETE on AuditLog is blocked entirely (grant revocation)', async () => {
      const legitId = newAuditId()
      await prisma.auditLog.create({
        data: {
          id: legitId,
          actorUserId: founderId,
          action: `${TEST_ACTION_PREFIX}pre-delete`,
        },
      })
      createdAuditIds.push(legitId)

      await expect(
        withSession({ user_id: founderId, school_id: schoolId }, async (tx) => {
          await tx.auditLog.delete({ where: { id: legitId } })
        }),
      ).rejects.toThrow()

      const row = await prisma.auditLog.findUnique({ where: { id: legitId } })
      expect(row).not.toBeNull()
    })
  })

  // -----------------------------------------------------------------
  // CanvasToken isolation — the highest-value piece of data in the schema
  // -----------------------------------------------------------------
  describe('CanvasToken isolation', () => {
    let founderTokenId: string | null = null

    beforeAll(async () => {
      // Create a CanvasToken for the founder so we have a row to test against.
      const existing = await prisma.canvasToken.findUnique({
        where: { userId: founderId },
      })
      if (existing) {
        founderTokenId = existing.id
      } else {
        const token = await prisma.canvasToken.create({
          data: {
            userId: founderId,
            // Format matches the v2:<iv>:<tag>:<ciphertext> schema; not a real
            // encrypted token. The encryption module lands in Milestone D.
            encryptedToken: 'v2:test:test:test',
          },
        })
        founderTokenId = token.id
      }
    })

    afterAll(async () => {
      // Don't delete pre-existing tokens. Only delete the one we created here
      // — if `existing` was null at beforeAll we made it; otherwise leave it.
      if (founderTokenId) {
        const row = await prisma.canvasToken.findUnique({ where: { id: founderTokenId } })
        if (row?.encryptedToken === 'v2:test:test:test') {
          await prisma.canvasToken.delete({ where: { id: founderTokenId } })
        }
      }
    })

    it('founder can see their own CanvasToken row', async () => {
      await withSession({ user_id: founderId, school_id: schoolId }, async (tx) => {
        const tokens = await tx.canvasToken.findMany()
        expect(tokens.some((t) => t.userId === founderId)).toBe(true)
      })
    })

    it('classmate cannot see the founder CanvasToken row', async () => {
      await withSession({ user_id: classmateId, school_id: schoolId }, async (tx) => {
        const tokens = await tx.canvasToken.findMany()
        expect(tokens.some((t) => t.userId === founderId)).toBe(false)
      })
    })
  })
})
