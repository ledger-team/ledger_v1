// Study-tab reads. Everything goes through withSession (RLS-enforced), and the
// app layer still filters by session.user.id — RLS is the backstop for a missed
// WHERE, not a replacement for writing one.

import { withSession } from '@/lib/db/withSession'
import type { AppSession } from '@/lib/auth/session'
import { summarizeAll, type CourseGrade, type Snapshot } from './grades'
import type { UpcomingAssignment } from './weekAhead'

export type StudyCourse = { id: string; name: string; courseCode: string }

export type StudyData = {
  courses: StudyCourse[]
  grades: CourseGrade[]
  /** Everything from 14 days back to 14 days ahead; the view slices what it needs. */
  assignments: UpcomingAssignment[]
}

const HISTORY_DAYS = 90
const WINDOW_DAYS = 14

export async function getStudyData(session: AppSession): Promise<StudyData> {
  const now = Date.now()
  const historySince = new Date(now - HISTORY_DAYS * 86_400_000)
  const from = new Date(now - WINDOW_DAYS * 86_400_000)
  const to = new Date(now + WINDOW_DAYS * 86_400_000)

  const { courses, snapshots, assignments } = await withSession(
    { user_id: session.user.id, school_id: session.user.schoolId ?? null },
    async (tx) => {
      const courses = await tx.course.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, courseCode: true },
      })
      const snapshots = await tx.gradeSnapshot.findMany({
        where: { userId: session.user.id, capturedAt: { gte: historySince } },
        orderBy: { capturedAt: 'asc' },
        select: { courseId: true, score: true, grade: true, capturedAt: true },
      })
      const assignments = await tx.assignment.findMany({
        where: { dueAt: { gte: from, lte: to } },
        orderBy: { dueAt: 'asc' },
        select: {
          id: true,
          name: true,
          dueAt: true,
          pointsPossible: true,
          course: { select: { id: true, name: true } },
        },
      })
      return { courses, snapshots, assignments }
    },
  )

  const grades = summarizeAll(
    courses.map((c) => c.id),
    snapshots as Snapshot[],
    30,
    new Date(now),
  )

  return { courses, grades, assignments }
}

export type AssignmentDetail = {
  id: string
  name: string
  description: string | null
  dueAt: Date | null
  pointsPossible: number | null
  submissionType: string | null
  course: { id: string; name: string; courseCode: string }
  notes: { id: string; body: string; done: boolean; position: number }[]
}

/** Null when the assignment does not exist OR the user cannot see it (RLS). */
export async function getAssignment(
  session: AppSession,
  assignmentId: string,
): Promise<AssignmentDetail | null> {
  return withSession(
    { user_id: session.user.id, school_id: session.user.schoolId ?? null },
    async (tx) => {
      const assignment = await tx.assignment.findUnique({
        where: { id: assignmentId },
        select: {
          id: true,
          name: true,
          description: true,
          dueAt: true,
          pointsPossible: true,
          submissionType: true,
          course: { select: { id: true, name: true, courseCode: true } },
        },
      })
      if (!assignment) return null

      const notes = await tx.assignmentNote.findMany({
        where: { userId: session.user.id, assignmentId },
        orderBy: { position: 'asc' },
        select: { id: true, body: true, done: true, position: true },
      })
      return { ...assignment, notes }
    },
  )
}
