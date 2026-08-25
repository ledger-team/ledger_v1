// Dashboard reads. Everything goes through withSession (RLS-enforced): the
// assignment_select / course_select policies are enrollment-gated, so these
// queries return ONLY the logged-in user's enrolled courses and their
// assignments. No service-role on reads.
//
// Grades come from GradeSnapshot, NOT from Course.currentScore. A Course row is
// shared by every student at the school in that Canvas course, so a per-student
// score written there is overwritten by whoever synced last — wrong numbers, and
// one student's grade shown to another. GradeSnapshot is keyed by userId.

import { withSession } from '@/lib/db/withSession'
import type { AppSession } from '@/lib/auth/session'

export type DashboardCourse = {
  id: string
  name: string
  currentGrade: string | null
  currentScore: number | null
}

export type DashboardAssignment = {
  id: string
  name: string
  dueAt: Date | null
  pointsPossible: number | null
  course: { id: string; name: string }
}

export type DashboardData = {
  courses: DashboardCourse[]
  assignments: DashboardAssignment[]
}

export async function getDashboardData(session: AppSession): Promise<DashboardData> {
  // Future assignments plus anything due in the last 24h. Null-due omitted (G2).
  const cutoff = new Date(Date.now() - 24 * 3_600_000)

  return withSession(
    { user_id: session.user.id, school_id: session.user.schoolId ?? null },
    async (tx) => {
      const assignments = await tx.assignment.findMany({
        where: { dueAt: { gte: cutoff } },
        orderBy: { dueAt: 'asc' },
        select: {
          id: true,
          name: true,
          dueAt: true,
          pointsPossible: true,
          course: { select: { id: true, name: true } },
        },
      })
      const courseRows = await tx.course.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      })

      // Newest snapshot per course. A student has a handful of courses and we
      // keep only changed readings, so pulling the window and reducing in JS is
      // cheaper than a correlated subquery per course.
      const snapshots = await tx.gradeSnapshot.findMany({
        where: { userId: session.user.id },
        orderBy: { capturedAt: 'desc' },
        select: { courseId: true, score: true, grade: true },
      })
      const latest = new Map<string, { score: number | null; grade: string | null }>()
      for (const s of snapshots) {
        if (!latest.has(s.courseId)) latest.set(s.courseId, { score: s.score, grade: s.grade })
      }

      const courses: DashboardCourse[] = courseRows.map((c) => ({
        id: c.id,
        name: c.name,
        currentGrade: latest.get(c.id)?.grade ?? null,
        currentScore: latest.get(c.id)?.score ?? null,
      }))

      return { courses, assignments }
    },
  )
}
