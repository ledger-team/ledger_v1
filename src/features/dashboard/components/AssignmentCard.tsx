import { classifyUrgency, type Urgency } from '../urgency'
import { courseColorVar } from '../courseColor'
import type { DashboardAssignment } from '../queries'
import { StudyGuideButton } from './StudyGuideButton'

const BORDER: Record<Urgency, string> = {
  due_soon: 'border-l-[3px] border-urgent',
  this_week: 'border-l-[3px] border-warn',
  normal: 'border-l-[3px] border-transparent',
}

const BADGE: Partial<Record<Urgency, { label: string; cls: string }>> = {
  due_soon: { label: 'DUE SOON', cls: 'bg-urgent/15 text-urgent' },
  this_week: { label: 'THIS WEEK', cls: 'bg-warn/15 text-warn' },
}

const DUE_COLOR: Record<Urgency, string> = {
  due_soon: 'text-urgent',
  this_week: 'text-muted',
  normal: 'text-muted',
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
    <div
      className={`rounded-2xl bg-surface p-4 transition-transform hover:scale-[1.01] ${BORDER[urgency]}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-xs text-muted">
          <span
            className="h-[7px] w-[7px] shrink-0 rounded-full"
            style={{ background: courseColorVar(assignment.course.id) }}
          />
          <span className="truncate">{assignment.course.name}</span>
        </span>
        {badge && (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${badge.cls}`}
          >
            {badge.label}
          </span>
        )}
      </div>

      <h3 className="mt-2 text-[15px] font-medium text-foreground">{assignment.name}</h3>

      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs">
        {assignment.dueAt && <span className={DUE_COLOR[urgency]}>{formatDue(assignment.dueAt)}</span>}
        {assignment.pointsPossible != null && (
          <span className="text-muted">· {assignment.pointsPossible} pts</span>
        )}
      </div>

      <StudyGuideButton assignmentId={assignment.id} />
    </div>
  )
}
