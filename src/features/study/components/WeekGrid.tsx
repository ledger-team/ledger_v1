import Link from 'next/link'
import { busiestDay, groupByDay, type UpcomingAssignment } from '../weekAhead'

const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

export function WeekGrid({ assignments }: { assignments: UpcomingAssignment[] }) {
  const buckets = groupByDay(assignments, 7)
  const heaviest = busiestDay(buckets)
  const anything = buckets.some((b) => b.items.length > 0)

  if (!anything) {
    return (
      <div className="rounded-xl border border-foreground/10 bg-surface p-6 text-center">
        <p className="text-sm font-medium">Nothing due this week</p>
        <p className="mt-1 text-sm text-muted">
          Either you&apos;re ahead or your teachers haven&apos;t posted yet. Enjoy it.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {buckets.map((b) => {
        const empty = b.items.length === 0
        const isHeaviest = heaviest !== null && b.date.getTime() === heaviest.date.getTime() && !empty

        return (
          <div
            key={b.date.toISOString()}
            className={`flex gap-3 rounded-xl border p-3 sm:p-4 ${
              empty
                ? 'border-transparent bg-surface/40'
                : isHeaviest
                  ? 'border-warn/30 bg-surface'
                  : 'border-foreground/10 bg-surface'
            }`}
          >
            <div className="w-12 shrink-0 pt-0.5">
              <p className={`text-xs font-semibold ${b.isToday ? 'text-accent' : 'text-muted'}`}>
                {b.isToday ? 'TODAY' : DOW[b.date.getDay()]}
              </p>
              <p className="text-xs text-muted tabular-nums">{b.date.getDate()}</p>
            </div>

            <div className="min-w-0 flex-1">
              {empty ? (
                <p className="pt-0.5 text-sm text-muted">Nothing due</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {b.items.map((a) => (
                    <li key={a.id} className="flex items-baseline justify-between gap-3">
                      <Link
                        href={`/assignment/${a.id}`}
                        className="min-w-0 flex-1 truncate text-sm hover:text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        {a.name}
                        <span className="ml-2 text-xs text-muted">{a.course.name}</span>
                      </Link>
                      {a.pointsPossible !== null && (
                        <span className="shrink-0 text-xs text-muted tabular-nums">
                          {a.pointsPossible} pts
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {!empty && b.totalPoints > 0 && (
              <div className="shrink-0 pt-0.5 text-right">
                <p
                  className={`text-sm font-semibold tabular-nums ${isHeaviest ? 'text-warn' : 'text-muted'}`}
                >
                  {b.totalPoints}
                </p>
                <p className="text-[0.65rem] text-muted">pts</p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
