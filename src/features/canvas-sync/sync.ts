// Canvas → database sync for one user.
//
// WRITE PATH: service-role Prisma client (bypasses RLS). This is a deliberate,
// sync-specific override of Decision F2 (made after three iterations against the
// live DB). Rationale:
//   1. App-layer validation is the primary guard here: syncUserCanvas loads
//      user.schoolId and school.canvasUrl up front and only ever writes that
//      user's school / that user's enrollments — a user cannot sync into another
//      user's school. That check, not RLS, is the real authorization boundary
//      for this trusted server-side job.
//   2. The service-role client is already the read path for id mapping and for
//      the audit/seed writes elsewhere in the codebase.
//   3. RLS here exists to backstop app-layer BUGS, not to be the primary sync
//      write path. It stays fully in force for every other code path.
//   4. The Course/Section/Assignment policies have cascading complications as a
//      *write* path — INSERT...RETURNING and INSERT...ON CONFLICT both require the
//      enrollment-gated SELECT policy (invisible row → 42501), Section's policy
//      hits 42P17 recursion, and Assignment's WITH CHECK fails during the
//      enrollment chicken-and-egg. Making RLS a clean sync write path needs a
//      schema/policy migration. TRACKED AS A FOLLOW-UP — not done here.
//
// withSession (RLS-enforced) remains the path for ALL non-sync code: dashboard
// reads, future feature writes, etc. Only this trusted sync job uses service role.
//
// Partial failure model (Decision F3): one transaction per entity type. A later
// type failing leaves earlier types committed; User.lastSyncedAt is set only when
// every phase succeeds.

import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/db/prisma'
import { logger } from '@/lib/log/logger'
import { EVENTS } from '@/lib/analytics/events'
import { getDecryptedToken } from './token'
import {
  CanvasApiError,
  CanvasAuthError,
  CanvasUnavailableError,
  createCanvasClient,
  type CanvasAssignment,
  type CanvasCourse,
  type CanvasSection,
  type CanvasSelfEnrollment,
} from './canvas'

export type SyncStatus = 'ok' | 'partial' | 'auth_error' | 'unavailable' | 'no_token' | 'error'
export type SyncCounts = { courses: number; sections: number; enrollments: number; assignments: number }
export type SyncResult = { status: SyncStatus; counts: SyncCounts }

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e))

function studentGrade(c: CanvasCourse) {
  return c.enrollments?.find((e) => e.type?.toLowerCase().includes('student')) ?? c.enrollments?.[0]
}

export async function syncUserCanvas(
  userId: string,
  createClient: typeof createCanvasClient = createCanvasClient,
): Promise<SyncResult> {
  const counts: SyncCounts = { courses: 0, sections: 0, enrollments: 0, assignments: 0 }

  const report = (err: unknown, phase: string) => {
    logger.error(
      { event: EVENTS.canvas.sync_failed, userId, phase, err: msg(err) },
      `canvas sync ${phase} failed`,
    )
    Sentry.captureException(err, { tags: { domain: 'canvas-sync', phase }, extra: { userId } })
  }
  const fail = (status: SyncStatus, err: unknown): SyncResult => {
    report(err, status)
    return { status, counts }
  }

  // App-layer authorization: resolve (and thereby pin) the user's own school.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { schoolId: true, school: { select: { canvasUrl: true } } },
  })
  if (!user?.schoolId || !user.school) return { status: 'error', counts }
  const schoolId = user.schoolId

  let token: string | null
  try {
    token = await getDecryptedToken(userId)
  } catch (err) {
    return fail('error', err)
  }
  if (!token) return { status: 'no_token', counts }

  const client = createClient({ baseUrl: user.school.canvasUrl, token })
  logger.info({ event: EVENTS.canvas.sync_started, userId }, 'canvas sync started')

  // ---- Fetch phase ----
  let canvasUserId = ''
  let courses: CanvasCourse[] = []
  let selfEnrollments: CanvasSelfEnrollment[] = []
  const sectionsByCourse = new Map<number, CanvasSection[]>()
  const assignmentsByCourse = new Map<number, CanvasAssignment[]>()
  try {
    const self = await client.getSelf()
    canvasUserId = String(self.id)
    ;[courses, selfEnrollments] = await Promise.all([
      client.listCourses(),
      client.listSelfEnrollments(),
    ])
    for (const c of courses) {
      sectionsByCourse.set(c.id, await client.listSections(c.id))
      assignmentsByCourse.set(c.id, await client.listAssignments(c.id))
    }
  } catch (err) {
    if (err instanceof CanvasAuthError) return fail('auth_error', err)
    if (err instanceof CanvasUnavailableError) return fail('unavailable', err)
    if (err instanceof CanvasApiError) return fail('error', err)
    return fail('error', err)
  }

  // ---- Persist phase: one transaction per entity type (service role) ----
  const failures: string[] = []
  const courseIdByCanvas = new Map<number, string>()
  const sectionIdByCanvas = new Map<number, string>()

  // Courses (+ stamp canvasUserId on the user).
  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { canvasUserId } })
      for (const c of courses) {
        const g = studentGrade(c)
        const data = {
          name: c.name,
          courseCode: c.course_code,
          currentGrade: g?.computed_current_grade ?? null,
          currentScore: g?.computed_current_score ?? null,
          finalGrade: g?.computed_final_grade ?? null,
          finalScore: g?.computed_final_score ?? null,
          lastSyncedAt: new Date(),
        }
        const row = await tx.course.upsert({
          where: { schoolId_canvasCourseId: { schoolId, canvasCourseId: String(c.id) } },
          create: { schoolId, canvasCourseId: String(c.id), ...data },
          update: data,
          select: { id: true },
        })
        courseIdByCanvas.set(c.id, row.id)
      }
    })
    counts.courses = courses.length
  } catch (err) {
    return fail('error', err) // nothing downstream can map without course ids
  }

  // Sections.
  try {
    await prisma.$transaction(async (tx) => {
      for (const [canvasCourseId, sections] of sectionsByCourse) {
        const ourCourseId = courseIdByCanvas.get(canvasCourseId)
        if (!ourCourseId) continue
        for (const s of sections) {
          const row = await tx.section.upsert({
            where: { courseId_canvasSectionId: { courseId: ourCourseId, canvasSectionId: String(s.id) } },
            create: { courseId: ourCourseId, canvasSectionId: String(s.id), name: s.name },
            update: { name: s.name },
            select: { id: true },
          })
          sectionIdByCanvas.set(s.id, row.id)
          counts.sections++
        }
      }
    })
  } catch (err) {
    failures.push('sections')
    report(err, 'sections')
  }

  // Enrollments (the user's own section memberships).
  try {
    await prisma.$transaction(async (tx) => {
      for (const e of selfEnrollments) {
        const ourSectionId = sectionIdByCanvas.get(e.course_section_id)
        if (!ourSectionId) continue
        await tx.enrollment.upsert({
          where: { userId_sectionId: { userId, sectionId: ourSectionId } },
          create: { userId, sectionId: ourSectionId },
          update: {},
        })
        counts.enrollments++
      }
    })
  } catch (err) {
    failures.push('enrollments')
    report(err, 'enrollments')
  }

  // Assignments — individual upserts, deliberately NOT wrapped in a single
  // transaction. A course can have 50+ assignments, and one transaction holding
  // that many writes can outlive the Supabase transaction-mode pooler's window
  // ("Transaction not found ... old closed transaction"). Each service-role
  // upsert is atomic on its own, so per-row writes are correct and put the least
  // pressure on the pooler.
  try {
    for (const [canvasCourseId, assignments] of assignmentsByCourse) {
      const ourCourseId = courseIdByCanvas.get(canvasCourseId)
      if (!ourCourseId) continue
      for (const a of assignments) {
        const data = {
          name: a.name,
          description: a.description ?? null,
          dueAt: a.due_at ? new Date(a.due_at) : null,
          pointsPossible: a.points_possible ?? null,
          submissionType: a.submission_types?.[0] ?? null,
        }
        await prisma.assignment.upsert({
          where: { courseId_canvasId: { courseId: ourCourseId, canvasId: String(a.id) } },
          create: { courseId: ourCourseId, canvasId: String(a.id), ...data },
          update: data,
        })
        counts.assignments++
      }
    }
  } catch (err) {
    failures.push('assignments')
    report(err, 'assignments')
  }

  // ---- Finalize: lastSyncedAt only on full success ----
  if (failures.length === 0) {
    await prisma.user.update({ where: { id: userId }, data: { lastSyncedAt: new Date() } })
    logger.info({ event: EVENTS.canvas.sync_succeeded, userId, ...counts }, 'canvas sync succeeded')
    return { status: 'ok', counts }
  }

  logger.error(
    { event: EVENTS.canvas.sync_failed, userId, failures, ...counts },
    'canvas sync completed with partial failure',
  )
  return { status: 'partial', counts }
}
