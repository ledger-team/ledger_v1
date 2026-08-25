import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth/session'
import { getAssignment } from '@/features/study/queries'
import { Notes } from '@/features/study/components/Notes'
import { classifyUrgency } from '@/features/dashboard/urgency'

// Canvas descriptions are HTML we did not author, so they are never dangerously
// set. Strip to text and render it as text. Most are empty anyway — 98% of the
// synced set at DSHS — so the empty state is the common case, not the exception.
function toText(html: string | null): string {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#\d+;/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const URGENCY: Record<string, { label: string; cls: string } | null> = {
  due_soon: { label: 'DUE SOON', cls: 'border-urgent/40 bg-urgent/10 text-urgent' },
  this_week: { label: 'THIS WEEK', cls: 'border-warn/40 bg-warn/10 text-warn' },
  normal: null,
}

export default async function AssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession()
  if (!session) redirect('/login')

  const { id } = await params
  const assignment = await getAssignment(session, id)
  // Also covers "exists but RLS hid it" — an assignment in a course you are not
  // enrolled in is indistinguishable from one that does not exist. That is the
  // correct behavior, not an accident.
  if (!assignment) notFound()

  const description = toText(assignment.description)
  const badge = assignment.dueAt ? URGENCY[classifyUrgency(assignment.dueAt)] : null

  return (
    <div className="flex flex-col gap-8 pb-8">
      <div>
        <Link href="/study" className="text-sm text-muted hover:text-foreground hover:underline">
          ← Study
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted">{assignment.course.name}</span>
          {badge && (
            <span className={`rounded-md border px-1.5 py-0.5 text-[0.65rem] font-semibold ${badge.cls}`}>
              {badge.label}
            </span>
          )}
        </div>

        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">{assignment.name}</h1>

        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
          <span>
            {assignment.dueAt
              ? `Due ${assignment.dueAt.toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })} at ${assignment.dueAt.toLocaleTimeString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                })}`
              : 'No due date'}
          </span>
          {assignment.pointsPossible !== null && (
            <span className="tabular-nums">{assignment.pointsPossible} points</span>
          )}
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold tracking-tight">From Canvas</h2>
        {description ? (
          <p className="rounded-xl border border-foreground/10 bg-surface p-4 text-sm leading-relaxed whitespace-pre-line text-foreground/80">
            {description}
          </p>
        ) : (
          <div className="rounded-xl border border-dashed border-foreground/15 p-4">
            <p className="text-sm text-muted">
              Your teacher didn&apos;t put a description on this one. Most of them don&apos;t. Whatever
              you need to remember about it can go in your notes below.
            </p>
          </div>
        )}
      </section>

      <Notes assignmentId={assignment.id} notes={assignment.notes} />
    </div>
  )
}
