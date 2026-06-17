import { classifyUrgency, type Urgency } from '../urgency'
import type { DashboardAssignment } from '../queries'
import { StudyGuideButton } from './StudyGuideButton'

const BORDER: Record<Urgency, string> = {
  due_soon: 'border-l-4 border-urgent',
  this_week: 'border-l-4 border-warn',
  normal: 'border-l-4 border-transparent',
}

const BADGE: Partial<Record<Urgency, { label: string; cls: string }>> = {
  due_soon: { label: 'DUE SOON', cls: 'bg-urgent/15 text-urgent' },
  this_week: { label: 'THIS WEEK', cls: 'bg-warn/15 text-warn' },
}

function formatDue(d: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d)
}

export function AssignmentCard({ assignment }: { assignment: DashboardAssignment }) {
  const urgency = classifyUrgency(assignment.dueAt)
  const badge = BADGE[urgency]

  return (
    <article className={`rounded-xl bg-surface p-4 ${BORDER[urgency]}`}>
      {badge && (
        <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${badge.cls}`}>
          {badge.label}
        </span>
      )}
      <h3 className="mt-1 text-base font-semibold text-foreground">{assignment.name}</h3>
      <p className="mt-0.5 text-sm text-muted">
        {assignment.course.name}
        {assignment.pointsPossible != null && ` · ${assignment.pointsPossible} pts`}
      </p>
      {assignment.dueAt && (
        <p className="mt-0.5 text-sm text-muted">{formatDue(assignment.dueAt)}</p>
      )}
      <StudyGuideButton assignmentId={assignment.id} />
    </article>
  )
}
