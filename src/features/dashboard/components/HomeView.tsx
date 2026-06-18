import { SparkleIcon } from '@/components/icons'
import type { DashboardData, DashboardAssignment } from '../queries'
import { GradePills } from './GradePills'
import { AssignmentCard } from './AssignmentCard'
import { RevealList, RevealItem } from './Reveal'

const SEVEN_DAYS_MS = 7 * 24 * 3_600_000

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface p-8 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-raised p-2.5 text-accent">
        <SparkleIcon />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted">{subtitle}</p>
    </div>
  )
}

function Section({
  title,
  assignments,
  emptyTitle,
  emptySubtitle,
}: {
  title: string
  assignments: DashboardAssignment[]
  emptyTitle: string
  emptySubtitle: string
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-medium uppercase tracking-wider text-muted">{title}</h2>
      {assignments.length === 0 ? (
        <EmptyState title={emptyTitle} subtitle={emptySubtitle} />
      ) : (
        <RevealList className="flex flex-col gap-4">
          {assignments.map((a) => (
            <RevealItem key={a.id}>
              <AssignmentCard assignment={a} />
            </RevealItem>
          ))}
        </RevealList>
      )}
    </section>
  )
}

export function HomeView({
  greeting,
  schoolName,
  data,
  syncBanner,
}: {
  greeting: string
  schoolName: string | null
  data: DashboardData
  syncBanner?: string | null
}) {
  const horizon = Date.now() + SEVEN_DAYS_MS
  const next7 = data.assignments.filter((a) => a.dueAt && a.dueAt.getTime() < horizon)
  const later = data.assignments.filter((a) => a.dueAt && a.dueAt.getTime() >= horizon)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[22px] font-medium leading-tight text-foreground sm:text-2xl">
          {greeting}
        </h1>
        {schoolName && <p className="mt-1 text-sm text-muted">{schoolName}</p>}
      </div>

      {syncBanner && (
        <div className="rounded-xl bg-surface px-4 py-3 text-sm text-muted">{syncBanner}</div>
      )}

      <GradePills courses={data.courses} />

      <Section
        title="Next 7 days"
        assignments={next7}
        emptyTitle="You're all clear"
        emptySubtitle="Nothing due in the next week."
      />
      <Section
        title="Coming up"
        assignments={later}
        emptyTitle="Nothing on the horizon"
        emptySubtitle="Future assignments will show up here."
      />
    </div>
  )
}
