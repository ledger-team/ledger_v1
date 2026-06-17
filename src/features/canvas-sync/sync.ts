// Canvas → database sync for one user.
//
// Writes run under withSession (RLS-enforced, Decision F2): the WITH CHECK
// policies in migration 0002 confirm a sync can only write within the user's own
// school (course/section/assignment) and own enrollments.
//
// RLS caveat (found + measured in F live verification): Course/Section/Assignment
// SELECT is enrollment-gated, and during sync the row has no enrollment yet, so:
//   - Prisma create/upsert use INSERT ... RETURNING; Postgres applies the SELECT
//     policy to RETURNING rows → the just-written row is invisible → error.
//   - INSERT ... ON CONFLICT (even DO NOTHING) also requires the SELECT policy to
//     read the conflict arbiter → same 42501 failure.
//   - But a plain INSERT (WITH CHECK only) and an UPDATE ... WHERE (USING only)
//     both succeed.
// Fix (Decision: "raw writes + service-role id read-back"): upsert those three via
// raw UPDATE-then-INSERT-if-missing (no ON CONFLICT, no RETURNING), then read the
// surrogate ids back with the service-role client for FK mapping. Enrollments are
// user-scoped (enrollment_select = current_user_id), so their row is visible after
// write — those stay ordinary Prisma upserts.
//
// Partial failure model (Decision F3): one transaction per entity type. A later
// type failing leaves earlier types committed; User.lastSyncedAt is set only when
// every phase succeeds.

import { randomUUID } from 'node:crypto'
import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/db/prisma'
import { withSession, type SessionClaims } from '@/lib/db/withSession'
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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { schoolId: true, school: { select: { canvasUrl: true } } },
  })
  if (!user?.schoolId || !user.school) return { status: 'error', counts }
  const schoolId = user.schoolId
  const claims: SessionClaims = { user_id: userId, school_id: schoolId }

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

  // ---- Persist phase: one transaction per entity type ----
  const failures: string[] = []
  // canvasCanvasId(string) -> our surrogate id
  const courseIdByCanvas = new Map<string, string>()
  const sectionIdByCanvas = new Map<string, string>()

  // Courses (+ stamp canvasUserId on the user; the user's own row is visible to
  // itself, so that one stays an ordinary Prisma update).
  try {
    await withSession(claims, async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { canvasUserId } })
      for (const c of courses) {
        const g = studentGrade(c)
        const updated = await tx.$executeRaw`
          UPDATE "Course" SET
            "name" = ${c.name}, "courseCode" = ${c.course_code},
            "currentGrade" = ${g?.computed_current_grade ?? null},
            "currentScore" = ${g?.computed_current_score ?? null},
            "finalGrade" = ${g?.computed_final_grade ?? null},
            "finalScore" = ${g?.computed_final_score ?? null},
            "lastSyncedAt" = now(), "updatedAt" = now()
          WHERE "schoolId" = ${schoolId} AND "canvasCourseId" = ${String(c.id)}
        `
        if (updated === 0) {
          await tx.$executeRaw`
            INSERT INTO "Course"
              ("id","schoolId","canvasCourseId","name","courseCode",
               "currentGrade","currentScore","finalGrade","finalScore",
               "lastSyncedAt","createdAt","updatedAt")
            VALUES
              (${randomUUID()}, ${schoolId}, ${String(c.id)}, ${c.name}, ${c.course_code},
               ${g?.computed_current_grade ?? null}, ${g?.computed_current_score ?? null},
               ${g?.computed_final_grade ?? null}, ${g?.computed_final_score ?? null},
               now(), now(), now())
          `
        }
      }
    })
    // Read ids back (service role — bypasses the enrollment-gated SELECT policy).
    const rows = await prisma.course.findMany({
      where: { schoolId, canvasCourseId: { in: courses.map((c) => String(c.id)) } },
      select: { id: true, canvasCourseId: true },
    })
    for (const r of rows) courseIdByCanvas.set(r.canvasCourseId, r.id)
    counts.courses = courses.length
  } catch (err) {
    return fail('error', err) // nothing downstream can map without course ids
  }

  // Sections.
  try {
    await withSession(claims, async (tx) => {
      for (const [canvasCourseId, sections] of sectionsByCourse) {
        const ourCourseId = courseIdByCanvas.get(String(canvasCourseId))
        if (!ourCourseId) continue
        for (const s of sections) {
          const updated = await tx.$executeRaw`
            UPDATE "Section" SET "name" = ${s.name}, "updatedAt" = now()
            WHERE "courseId" = ${ourCourseId} AND "canvasSectionId" = ${String(s.id)}
          `
          if (updated === 0) {
            await tx.$executeRaw`
              INSERT INTO "Section" ("id","courseId","canvasSectionId","name","createdAt","updatedAt")
              VALUES (${randomUUID()}, ${ourCourseId}, ${String(s.id)}, ${s.name}, now(), now())
            `
          }
          counts.sections++
        }
      }
    })
    const canvasSectionIds = [...sectionsByCourse.values()].flat().map((s) => String(s.id))
    const rows = await prisma.section.findMany({
      where: { course: { schoolId }, canvasSectionId: { in: canvasSectionIds } },
      select: { id: true, canvasSectionId: true },
    })
    for (const r of rows) sectionIdByCanvas.set(r.canvasSectionId, r.id)
  } catch (err) {
    failures.push('sections')
    report(err, 'sections')
  }

  // Enrollments (user-scoped → the new row is visible to its owner, so plain Prisma).
  try {
    await withSession(claims, async (tx) => {
      for (const e of selfEnrollments) {
        const ourSectionId = sectionIdByCanvas.get(String(e.course_section_id))
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

  // Assignments (no read-back needed).
  try {
    await withSession(claims, async (tx) => {
      for (const [canvasCourseId, assignments] of assignmentsByCourse) {
        const ourCourseId = courseIdByCanvas.get(String(canvasCourseId))
        if (!ourCourseId) continue
        for (const a of assignments) {
          const dueAt = a.due_at ? new Date(a.due_at) : null
          const submissionType = a.submission_types?.[0] ?? null
          const updated = await tx.$executeRaw`
            UPDATE "Assignment" SET
              "name" = ${a.name}, "description" = ${a.description ?? null}, "dueAt" = ${dueAt},
              "pointsPossible" = ${a.points_possible ?? null}, "submissionType" = ${submissionType},
              "updatedAt" = now()
            WHERE "courseId" = ${ourCourseId} AND "canvasId" = ${String(a.id)}
          `
          if (updated === 0) {
            await tx.$executeRaw`
              INSERT INTO "Assignment"
                ("id","courseId","canvasId","name","description","dueAt",
                 "pointsPossible","submissionType","isTestData","createdAt","updatedAt")
              VALUES
                (${randomUUID()}, ${ourCourseId}, ${String(a.id)}, ${a.name}, ${a.description ?? null},
                 ${dueAt}, ${a.points_possible ?? null}, ${submissionType}, false, now(), now())
            `
          }
          counts.assignments++
        }
      }
    })
  } catch (err) {
    failures.push('assignments')
    report(err, 'assignments')
  }

  // ---- Finalize: lastSyncedAt only on full success ----
  if (failures.length === 0) {
    await withSession(claims, async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { lastSyncedAt: new Date() } })
    })
    logger.info({ event: EVENTS.canvas.sync_succeeded, userId, ...counts }, 'canvas sync succeeded')
    return { status: 'ok', counts }
  }

  logger.error(
    { event: EVENTS.canvas.sync_failed, userId, failures, ...counts },
    'canvas sync completed with partial failure',
  )
  return { status: 'partial', counts }
}
