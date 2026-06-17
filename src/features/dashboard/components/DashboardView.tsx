import { ThemeToggle } from '@/components/ThemeToggle'
import type { DashboardData, DashboardAssignment } from '../queries'
import { CourseGrades } from './CourseGrades'
import { AssignmentCard } from './AssignmentCard'

const SEVEN_DAYS_MS = 7 * 24 * 3_600_000

function Section({
  title,
  assignments,
  empty,
}: {
  title: string
  assignments: DashboardAssignment[]
  empty: string
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-muted">{title}</h2>
      {assignments.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        assignments.map((a) => <AssignmentCard key={a.id} assignment={a} />)
      )}
    </section>
  )
}

export function DashboardView({
  name,
  schoolName,
  data,
  syncBanner,
}: {
  name: string
  schoolName: string | null
  data: DashboardData
  syncBanner?: string | null
}) {
  const horizon = Date.now() + SEVEN_DAYS_MS
  const next7 = data.assignments.filter((a) => a.dueAt && a.dueAt.getTime() < horizon)
  const later = data.assignments.filter((a) => a.dueAt && a.dueAt.getTime() >= horizon)

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xl font-bold tracking-tight text-accent">ledger</span>
          <p className="mt-1 text-sm text-muted">
            Welcome, {name}
            {schoolName ? ` · ${schoolName}` : ''}
          </p>
        </div>
        <ThemeToggle />
      </header>

      {syncBanner && (
        <div className="rounded-md bg-surface px-3 py-2 text-sm text-muted">{syncBanner}</div>
      )}

      <CourseGrades courses={data.courses} />

      <Section title="Next 7 days" assignments={next7} empty="Nothing due in the next week." />
      <Section title="Coming up" assignments={later} empty="Nothing else on the horizon." />
    </main>
  )
}
