// Pure grade-history logic. No DB, no React — all of it is unit tested.
//
// Input is the raw GradeSnapshot rows for one user, newest-first is NOT assumed;
// every function sorts what it needs.

export type Snapshot = {
  courseId: string
  score: number | null
  grade: string | null
  capturedAt: Date
}

export type Trend = 'up' | 'down' | 'flat' | 'new'

export type CourseGrade = {
  courseId: string
  score: number | null
  grade: string | null
  /** Change in score across the window, null when there's nothing to compare to. */
  delta: number | null
  trend: Trend
  /** Oldest → newest scores, for a sparkline. Null scores are dropped. */
  points: number[]
  capturedAt: Date | null
}

const asc = (a: Snapshot, b: Snapshot) => a.capturedAt.getTime() - b.capturedAt.getTime()

/** A move smaller than this is rounding noise from Canvas, not a real change. */
const MEANINGFUL = 0.5

export function classifyTrend(delta: number | null): Trend {
  if (delta === null) return 'new'
  if (delta > MEANINGFUL) return 'up'
  if (delta < -MEANINGFUL) return 'down'
  return 'flat'
}

/**
 * Collapse one course's snapshots into its current standing plus how it moved
 * over `windowDays`. Snapshots older than the window still count toward the
 * sparkline baseline but not toward `delta`.
 */
export function summarizeCourse(
  courseId: string,
  snapshots: Snapshot[],
  windowDays = 30,
  now: Date = new Date(),
): CourseGrade {
  const mine = snapshots.filter((s) => s.courseId === courseId).sort(asc)
  if (mine.length === 0) {
    return { courseId, score: null, grade: null, delta: null, trend: 'new', points: [], capturedAt: null }
  }

  const newest = mine[mine.length - 1]!
  const cutoff = now.getTime() - windowDays * 86_400_000
  const inWindow = mine.filter((s) => s.capturedAt.getTime() >= cutoff)

  // Compare against the oldest reading inside the window. If only one reading
  // exists there, we have nothing to measure movement against.
  const baseline = inWindow.length > 1 ? inWindow[0]! : null
  const delta =
    baseline && baseline.score !== null && newest.score !== null
      ? Number((newest.score - baseline.score).toFixed(1))
      : null

  return {
    courseId,
    score: newest.score,
    grade: newest.grade,
    delta,
    trend: classifyTrend(delta),
    points: mine.map((s) => s.score).filter((n): n is number => n !== null),
    capturedAt: newest.capturedAt,
  }
}

export function summarizeAll(
  courseIds: string[],
  snapshots: Snapshot[],
  windowDays = 30,
  now: Date = new Date(),
): CourseGrade[] {
  return courseIds.map((id) => summarizeCourse(id, snapshots, windowDays, now))
}

/** Ledger's grade colors (docs: >=90 lime, 80-89 neutral, 70-79 amber, <70 rose). */
export function gradeTone(score: number | null): 'good' | 'neutral' | 'warn' | 'bad' | 'none' {
  if (score === null) return 'none'
  if (score >= 90) return 'good'
  if (score >= 80) return 'neutral'
  if (score >= 70) return 'warn'
  return 'bad'
}

/** The courses worth surfacing first: biggest real movement, drops before rises. */
export function mostMoved(grades: CourseGrade[], limit = 3): CourseGrade[] {
  return grades
    .filter((g) => g.delta !== null && Math.abs(g.delta) > MEANINGFUL)
    .sort((a, b) => {
      const byDirection = Number(a.delta! > 0) - Number(b.delta! > 0) // drops first
      return byDirection !== 0 ? byDirection : Math.abs(b.delta!) - Math.abs(a.delta!)
    })
    .slice(0, limit)
}
