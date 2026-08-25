import Link from 'next/link'
import { mostMoved } from '../grades'
import type { StudyData } from '../queries'
import { overdue } from '../weekAhead'
import { GradeCard } from './GradeCard'
import { WeekGrid } from './WeekGrid'

export function StudyView({ data }: { data: StudyData }) {
  const nameOf = new Map(data.courses.map((c) => [c.id, c.name]))
  const moved = mostMoved(data.grades)
  const late = overdue(data.assignments)
  const hasAnyGrade = data.grades.some((g) => g.score !== null)

  return (
    <div className="flex flex-col gap-8 pb-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Study</h1>
        <p className="mt-1 text-sm text-muted">Where your grades are going, and what&apos;s coming.</p>
      </div>

      {/* Movement first: it is the only thing here that is genuinely news. */}
      {moved.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold tracking-tight">What changed</h2>
          <div className="flex flex-col gap-2">
            {moved.map((g) => (
              <GradeCard key={g.courseId} name={nameOf.get(g.courseId) ?? 'Course'} grade={g} />
            ))}
          </div>
        </section>
      )}

      {late.length > 0 && (
        <section className="rounded-xl border border-urgent/30 bg-urgent/5 p-4">
          <h2 className="text-sm font-semibold text-urgent">
            {late.length} past due
          </h2>
          <ul className="mt-2 flex flex-col gap-1.5">
            {late.slice(0, 5).map((a) => (
              <li key={a.id}>
                <Link
                  href={`/assignment/${a.id}`}
                  className="text-sm hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {a.name}
                  <span className="ml-2 text-xs text-muted">{a.course.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold tracking-tight">This week</h2>
        <WeekGrid assignments={data.assignments} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold tracking-tight">All grades</h2>
        {hasAnyGrade ? (
          <div className="flex flex-col gap-2">
            {data.grades.map((g) => (
              <GradeCard key={g.courseId} name={nameOf.get(g.courseId) ?? 'Course'} grade={g} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-foreground/10 bg-surface p-6 text-center">
            <p className="text-sm font-medium">No grades yet</p>
            <p className="mt-1 text-sm text-muted">
              Connect Canvas from the You tab and they&apos;ll show up here after a sync.
            </p>
          </div>
        )}
        <p className="text-xs text-muted">
          Trends start from your first sync. There&apos;s no history before Ledger was watching.
        </p>
      </section>
    </div>
  )
}
