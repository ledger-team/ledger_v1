import { gradeColor, type GradeTone } from '../urgency'
import { courseColorVar } from '../courseColor'
import type { DashboardCourse } from '../queries'

const TONE: Record<GradeTone, string> = {
  accent: 'text-accent',
  foreground: 'text-foreground',
  warn: 'text-warn',
  urgent: 'text-urgent',
}

// Tappable course pills: horizontal scroll on mobile, 3-col grid on desktop.
// The button is a no-op stub in G2 — Phase 1 wires it to course detail.
export function GradePills({ courses }: { courses: DashboardCourse[] }) {
  if (courses.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-medium uppercase tracking-wider text-muted">Grades</h2>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
        {courses.map((c) => {
          const tone = gradeColor(c.currentScore)
          const display =
            c.currentGrade ?? (c.currentScore != null ? String(Math.round(c.currentScore)) : '—')
          return (
            <button
              key={c.id}
              type="button"
              className="flex min-h-[4.5rem] min-w-[8rem] shrink-0 flex-col justify-between rounded-2xl bg-surface p-4 text-left transition-transform hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent md:min-w-0"
            >
              <span className="flex items-center gap-2">
                <span
                  className="h-[7px] w-[7px] shrink-0 rounded-full"
                  style={{ background: courseColorVar(c.id) }}
                />
                <span className="truncate text-xs text-muted">{c.name}</span>
              </span>
              <span className={`mt-2 text-2xl font-medium tabular-nums ${tone ? TONE[tone] : 'text-muted'}`}>
                {display}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
