import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    assignment: { upsert: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock('./token', () => ({ getDecryptedToken: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

import { syncUserCanvas } from './sync'
import { CanvasAuthError, CanvasUnavailableError, type CanvasClient } from './canvas'
import { prisma } from '@/lib/db/prisma'
import { getDecryptedToken } from './token'

function makeTx() {
  return {
    user: { update: vi.fn().mockResolvedValue({}) },
    course: {
      upsert: vi.fn().mockImplementation((a) =>
        Promise.resolve({ id: `c_${a.where.schoolId_canvasCourseId.canvasCourseId}` }),
      ),
    },
    section: {
      upsert: vi.fn().mockImplementation((a) =>
        Promise.resolve({ id: `s_${a.where.courseId_canvasSectionId.canvasSectionId}` }),
      ),
    },
    enrollment: { upsert: vi.fn().mockResolvedValue({}) },
    gradeSnapshot: {
      // No prior snapshot by default, so a first sync always records one.
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
  }
}

function fakeClient(overrides: Partial<CanvasClient> = {}): CanvasClient {
  return {
    getSelf: vi.fn().mockResolvedValue({ id: 99, name: 'Sam' }),
    listCourses: vi.fn().mockResolvedValue([
      {
        id: 1,
        name: 'AP World History',
        course_code: 'APWORLD',
        enrollments: [
          {
            type: 'StudentEnrollment',
            computed_current_score: 91.5,
            computed_current_grade: 'A-',
            computed_final_score: null,
            computed_final_grade: null,
          },
        ],
      },
    ]),
    listSections: vi.fn().mockResolvedValue([{ id: 11, name: 'Section 1' }]),
    listSelfEnrollments: vi
      .fn()
      .mockResolvedValue([{ course_id: 1, course_section_id: 11, type: 'StudentEnrollment' }]),
    listAssignments: vi.fn().mockResolvedValue([
      {
        id: 101,
        name: 'Reading Quiz 1',
        description: null,
        due_at: null,
        points_possible: 10,
        submission_types: ['online_text_entry'],
      },
    ]),
    ...overrides,
  }
}

let tx: ReturnType<typeof makeTx>
const factoryFor = (c: CanvasClient) => (() => c) as never
const dataOf = (m: { mock: { calls: unknown[][] } }) =>
  m.mock.calls.map((c) => (c[0] as { data: Record<string, unknown> }).data)

beforeEach(() => {
  vi.clearAllMocks()
  tx = makeTx()
  // Service-role: each entity phase is prisma.$transaction(async tx => ...).
  vi.mocked(prisma.$transaction).mockImplementation(((fn: (t: unknown) => unknown) =>
    fn(tx)) as never)
  vi.mocked(prisma.user.findUnique).mockResolvedValue({
    schoolId: 'school1',
    school: { canvasUrl: 'https://dsisd.instructure.com' },
  } as never)
  vi.mocked(prisma.user.update).mockResolvedValue({} as never)
  vi.mocked(prisma.assignment.upsert).mockResolvedValue({} as never)
  vi.mocked(getDecryptedToken).mockResolvedValue('canvas-token')
})

describe('syncUserCanvas (service-role writes)', () => {
  it('full success upserts every entity type, bumps lastSyncedAt, returns ok', async () => {
    const res = await syncUserCanvas('u1', factoryFor(fakeClient()))
    expect(res.status).toBe('ok')
    expect(res.counts).toEqual({
      courses: 1,
      sections: 1,
      enrollments: 1,
      assignments: 1,
      gradeSnapshots: 1,
    })
    // canvasUserId stamped inside the courses transaction.
    expect(dataOf(tx.user.update).some((d) => 'canvasUserId' in d)).toBe(true)
    // lastSyncedAt finalized on the service-role client.
    expect(dataOf(vi.mocked(prisma.user.update)).some((d) => 'lastSyncedAt' in d)).toBe(true)
    expect(tx.enrollment.upsert).toHaveBeenCalledTimes(1)
  })

  it('never writes a per-student grade onto the shared Course row', async () => {
    // Course is unique on (schoolId, canvasCourseId), so one row is shared by
    // every student at the school in that course. A grade written here would be
    // overwritten by the next classmate to sync, and shown to them as their own.
    await syncUserCanvas('u1', factoryFor(fakeClient()))
    for (const call of tx.course.upsert.mock.calls) {
      const arg = call[0] as { create: Record<string, unknown>; update: Record<string, unknown> }
      for (const shape of [arg.create, arg.update]) {
        expect(shape).not.toHaveProperty('currentScore')
        expect(shape).not.toHaveProperty('currentGrade')
        expect(shape).not.toHaveProperty('finalScore')
        expect(shape).not.toHaveProperty('finalGrade')
      }
    }
  })

  it('records the grade against the user, not the course row', async () => {
    await syncUserCanvas('u1', factoryFor(fakeClient()))
    expect(tx.gradeSnapshot.create).toHaveBeenCalledTimes(1)
    expect(dataOf(tx.gradeSnapshot.create)[0]).toMatchObject({
      userId: 'u1',
      courseId: 'c_1',
      score: 91.5,
      grade: 'A-',
    })
  })

  it('skips the snapshot when the grade has not moved', async () => {
    // Sync runs on every login; writing unchanged readings would bury real moves.
    tx.gradeSnapshot.findFirst.mockResolvedValue({ score: 91.5, grade: 'A-' })
    const res = await syncUserCanvas('u1', factoryFor(fakeClient()))
    expect(tx.gradeSnapshot.create).not.toHaveBeenCalled()
    expect(res.counts.gradeSnapshots).toBe(0)
  })

  it('records a snapshot when only the letter grade changes', async () => {
    tx.gradeSnapshot.findFirst.mockResolvedValue({ score: 91.5, grade: 'B+' })
    await syncUserCanvas('u1', factoryFor(fakeClient()))
    expect(tx.gradeSnapshot.create).toHaveBeenCalledTimes(1)
  })

  it('partial failure (assignments) keeps earlier types and does NOT bump lastSyncedAt', async () => {
    vi.mocked(prisma.assignment.upsert).mockRejectedValue(new Error('db boom'))
    const res = await syncUserCanvas('u1', factoryFor(fakeClient()))
    expect(res.status).toBe('partial')
    expect(res.counts.courses).toBe(1)
    expect(res.counts.sections).toBe(1)
    expect(res.counts.enrollments).toBe(1)
    expect(res.counts.assignments).toBe(0)
    expect(prisma.user.update).not.toHaveBeenCalled() // finalize skipped
  })

  it('returns auth_error when Canvas rejects the token', async () => {
    const client = fakeClient({ getSelf: vi.fn().mockRejectedValue(new CanvasAuthError('401')) })
    expect((await syncUserCanvas('u1', factoryFor(client))).status).toBe('auth_error')
  })

  it('returns unavailable when Canvas is unreachable', async () => {
    const client = fakeClient({
      getSelf: vi.fn().mockRejectedValue(new CanvasUnavailableError('down')),
    })
    expect((await syncUserCanvas('u1', factoryFor(client))).status).toBe('unavailable')
  })

  it('returns no_token when the user has no stored token', async () => {
    vi.mocked(getDecryptedToken).mockResolvedValue(null)
    expect((await syncUserCanvas('u1', factoryFor(fakeClient()))).status).toBe('no_token')
  })
})
