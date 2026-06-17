// Dashboard reads. Everything goes through withSession (RLS-enforced): the
// assignment_select / course_select policies are enrollment-gated, so these
// queries return ONLY the logged-in user's enrolled courses and their
// assignments. No service-role on reads.

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
      const courses = await tx.course.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, currentGrade: true, currentScore: true },
      })
      return { courses, assignments }
    },
  )
}
