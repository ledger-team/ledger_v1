import { gradeColor, type GradeTone } from '../urgency'
import type { DashboardCourse } from '../queries'

const TONE: Record<GradeTone, string> = {
  accent: 'text-accent',
  foreground: 'text-foreground',
  warn: 'text-warn',
  urgent: 'text-urgent',
}

export function CourseGrades({ courses }: { courses: DashboardCourse[] }) {
  if (courses.length === 0) return null

  return (
    <section className="rounded-xl bg-surface p-4">
      <h2 className="text-sm font-semibold text-muted">Your courses</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {courses.map((c) => {
          const tone = gradeColor(c.currentScore)
          const display =
            c.currentGrade ?? (c.currentScore != null ? String(Math.round(c.currentScore)) : '—')
          return (
            <li key={c.id} className="flex items-center justify-between gap-3">
              <span className="text-foreground">{c.name}</span>
              <span className={`font-semibold tabular-nums ${tone ? TONE[tone] : 'text-muted'}`}>
                {display}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
