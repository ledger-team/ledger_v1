import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db/prisma', () => ({
  prisma: { user: { findUnique: vi.fn() }, course: { findMany: vi.fn() }, section: { findMany: vi.fn() } },
}))
vi.mock('@/lib/db/withSession', () => ({ withSession: vi.fn() }))
vi.mock('./token', () => ({ getDecryptedToken: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

import { syncUserCanvas } from './sync'
import { CanvasAuthError, CanvasUnavailableError, type CanvasClient } from './canvas'
import { prisma } from '@/lib/db/prisma'
import { withSession } from '@/lib/db/withSession'
import { getDecryptedToken } from './token'

function makeTx() {
  return {
    user: { update: vi.fn().mockResolvedValue({}) },
    enrollment: { upsert: vi.fn().mockResolvedValue({}) },
    // tagged-template: first arg is the strings array; reject for a chosen table.
    $executeRaw: vi.fn().mockResolvedValue(1),
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
  vi.mocked(withSession).mockImplementation((_claims, fn) => fn(tx as never))
  vi.mocked(prisma.user.findUnique).mockResolvedValue({
    schoolId: 'school1',
    school: { canvasUrl: 'https://dsisd.instructure.com' },
  } as never)
  vi.mocked(prisma.course.findMany).mockResolvedValue([{ id: 'c1', canvasCourseId: '1' }] as never)
  vi.mocked(prisma.section.findMany).mockResolvedValue([
    { id: 's1', canvasSectionId: '11' },
  ] as never)
  vi.mocked(getDecryptedToken).mockResolvedValue('canvas-token')
})

describe('syncUserCanvas', () => {
  it('full success upserts every entity type, bumps lastSyncedAt, returns ok', async () => {
    const res = await syncUserCanvas('u1', factoryFor(fakeClient()))
    expect(res.status).toBe('ok')
    expect(res.counts).toEqual({ courses: 1, sections: 1, enrollments: 1, assignments: 1 })
    const updates = dataOf(tx.user.update)
    expect(updates.some((d) => 'canvasUserId' in d)).toBe(true)
    expect(updates.some((d) => 'lastSyncedAt' in d)).toBe(true)
    expect(tx.enrollment.upsert).toHaveBeenCalledTimes(1)
  })

  it('partial failure (assignments) keeps earlier types and does NOT bump lastSyncedAt', async () => {
    tx.$executeRaw.mockImplementation((strings: TemplateStringsArray) => {
      const sql = Array.from(strings).join(' ')
      return sql.includes('"Assignment"') ? Promise.reject(new Error('db boom')) : Promise.resolve(1)
    })
    const res = await syncUserCanvas('u1', factoryFor(fakeClient()))
    expect(res.status).toBe('partial')
    expect(res.counts.courses).toBe(1)
    expect(res.counts.sections).toBe(1)
    expect(res.counts.enrollments).toBe(1)
    expect(dataOf(tx.user.update).some((d) => 'lastSyncedAt' in d)).toBe(false)
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
