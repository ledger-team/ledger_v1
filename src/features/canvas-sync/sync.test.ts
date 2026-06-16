import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db/prisma', () => ({ prisma: { user: { findUnique: vi.fn() } } }))
vi.mock('@/lib/db/withSession', () => ({ withSession: vi.fn() }))
vi.mock('./token', () => ({ getDecryptedToken: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

import { syncUserCanvas } from './sync'
import { CanvasAuthError, CanvasUnavailableError, type CanvasClient } from './canvas'
import { prisma } from '@/lib/db/prisma'
import { withSession } from '@/lib/db/withSession'
import { getDecryptedToken } from './token'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeTx(): any {
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
    assignment: { upsert: vi.fn().mockResolvedValue({}) },
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

beforeEach(() => {
  vi.clearAllMocks()
  tx = makeTx()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(withSession).mockImplementation(async (_claims: any, fn: any) => fn(tx))
   
  vi.mocked(prisma.user.findUnique).mockResolvedValue({
    schoolId: 'school1',
    school: { canvasUrl: 'https://dsisd.instructure.com' },
  } as never)
  vi.mocked(getDecryptedToken).mockResolvedValue('canvas-token')
})

describe('syncUserCanvas', () => {
  it('full success upserts every entity type, bumps lastSyncedAt, returns ok', async () => {
    const res = await syncUserCanvas('u1', factoryFor(fakeClient()))
    expect(res.status).toBe('ok')
    expect(res.counts).toEqual({ courses: 1, sections: 1, enrollments: 1, assignments: 1 })
    const updates = tx.user.update.mock.calls.map((c: [{ data: Record<string, unknown> }]) => c[0].data)
    expect(updates.some((d: Record<string, unknown>) => 'lastSyncedAt' in d)).toBe(true)
    expect(updates.some((d: Record<string, unknown>) => 'canvasUserId' in d)).toBe(true)
  })

  it('partial failure (assignments) keeps earlier types and does NOT bump lastSyncedAt', async () => {
    tx.assignment.upsert.mockRejectedValue(new Error('db boom'))
    const res = await syncUserCanvas('u1', factoryFor(fakeClient()))
    expect(res.status).toBe('partial')
    expect(res.counts.courses).toBe(1)
    expect(res.counts.sections).toBe(1)
    expect(res.counts.enrollments).toBe(1)
    const updates = tx.user.update.mock.calls.map((c: [{ data: Record<string, unknown> }]) => c[0].data)
    expect(updates.some((d: Record<string, unknown>) => 'lastSyncedAt' in d)).toBe(false)
  })

  it('returns auth_error when Canvas rejects the token', async () => {
    const client = fakeClient({ getSelf: vi.fn().mockRejectedValue(new CanvasAuthError('401')) })
    const res = await syncUserCanvas('u1', factoryFor(client))
    expect(res.status).toBe('auth_error')
  })

  it('returns unavailable when Canvas is unreachable', async () => {
    const client = fakeClient({
      getSelf: vi.fn().mockRejectedValue(new CanvasUnavailableError('down')),
    })
    const res = await syncUserCanvas('u1', factoryFor(client))
    expect(res.status).toBe('unavailable')
  })

  it('returns no_token when the user has no stored token', async () => {
    vi.mocked(getDecryptedToken).mockResolvedValue(null)
    const res = await syncUserCanvas('u1', factoryFor(fakeClient()))
    expect(res.status).toBe('no_token')
  })
})
