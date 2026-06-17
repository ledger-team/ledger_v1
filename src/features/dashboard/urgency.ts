// Pure presentation logic for the dashboard. No DB, no React — trivially testable.

export type Urgency = 'due_soon' | 'this_week' | 'normal'

/**
 * Classify an assignment's due date into an urgency band.
 *   < 24h away (incl. overdue within the visible window) → due_soon (rose)
 *   < 72h away                                           → this_week (amber)
 *   otherwise                                            → normal (neutral)
 */
export function classifyUrgency(dueAt: Date | string | null, now: Date = new Date()): Urgency {
  if (!dueAt) return 'normal'
  const due = typeof dueAt === 'string' ? new Date(dueAt) : dueAt
  const hours = (due.getTime() - now.getTime()) / 3_600_000
  if (hours < 24) return 'due_soon'
  if (hours < 72) return 'this_week'
  return 'normal'
}

export type GradeTone = 'accent' | 'foreground' | 'warn' | 'urgent'

/**
 * Map a numeric course score to a color tone.
 *   >= 90 → accent (lime)   80-89 → foreground (white/black)
 *   70-79 → warn (amber)    < 70  → urgent (rose)
 * Returns null when there's no score (caller renders muted).
 */
export function gradeColor(score: number | null | undefined): GradeTone | null {
  if (score == null) return null
  if (score >= 90) return 'accent'
  if (score >= 80) return 'foreground'
  if (score >= 70) return 'warn'
  return 'urgent'
}
