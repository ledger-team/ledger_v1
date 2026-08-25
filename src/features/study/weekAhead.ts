// Pure "what does my week look like" logic. No DB, no React.

export type UpcomingAssignment = {
  id: string
  name: string
  dueAt: Date | null
  pointsPossible: number | null
  course: { id: string; name: string }
}

export type DayBucket = {
  /** Local midnight for this day. */
  date: Date
  items: UpcomingAssignment[]
  totalPoints: number
  isToday: boolean
}

function startOfDay(d: Date): Date {
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  return c
}

const DAY = 86_400_000

/**
 * Bucket assignments into consecutive days starting today. Empty days are kept
 * on purpose — a free Friday is information, and dropping it makes the week look
 * uniformly busy.
 */
export function groupByDay(
  assignments: UpcomingAssignment[],
  days = 7,
  now: Date = new Date(),
): DayBucket[] {
  const today = startOfDay(now)
  const buckets: DayBucket[] = Array.from({ length: days }, (_, i) => ({
    date: new Date(today.getTime() + i * DAY),
    items: [],
    totalPoints: 0,
    isToday: i === 0,
  }))

  for (const a of assignments) {
    if (!a.dueAt) continue
    const index = Math.floor((startOfDay(a.dueAt).getTime() - today.getTime()) / DAY)
    const bucket = buckets[index]
    if (!bucket) continue // outside the window, or already past
    bucket.items.push(a)
    bucket.totalPoints += a.pointsPossible ?? 0
  }

  for (const b of buckets) {
    b.items.sort((x, y) => (x.dueAt?.getTime() ?? 0) - (y.dueAt?.getTime() ?? 0))
  }
  return buckets
}

/** The heaviest day in the window, so the UI can call it out. Ties go earlier. */
export function busiestDay(buckets: DayBucket[]): DayBucket | null {
  const loaded = buckets.filter((b) => b.items.length > 0)
  if (loaded.length === 0) return null
  return loaded.reduce((max, b) => (b.totalPoints > max.totalPoints ? b : max), loaded[0]!)
}

/** Anything already past due, newest first. Separate from the week grid. */
export function overdue(
  assignments: UpcomingAssignment[],
  now: Date = new Date(),
): UpcomingAssignment[] {
  return assignments
    .filter((a) => a.dueAt !== null && a.dueAt.getTime() < now.getTime())
    .sort((a, b) => b.dueAt!.getTime() - a.dueAt!.getTime())
}
