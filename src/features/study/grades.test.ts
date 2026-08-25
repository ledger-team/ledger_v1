import { describe, expect, it } from 'vitest'
import { classifyTrend, gradeTone, mostMoved, summarizeAll, summarizeCourse, type Snapshot } from './grades'

const at = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000)
const snap = (courseId: string, score: number | null, daysAgo: number): Snapshot => ({
  courseId,
  score,
  grade: null,
  capturedAt: at(daysAgo),
})

describe('classifyTrend', () => {
  it('ignores sub-point rounding noise from Canvas', () => {
    expect(classifyTrend(0.4)).toBe('flat')
    expect(classifyTrend(-0.4)).toBe('flat')
  })
  it('calls real movement', () => {
    expect(classifyTrend(3)).toBe('up')
    expect(classifyTrend(-3)).toBe('down')
  })
  it('reports no history as new, not flat', () => {
    expect(classifyTrend(null)).toBe('new')
  })
})

describe('summarizeCourse', () => {
  it('takes the newest reading as current regardless of input order', () => {
    const g = summarizeCourse('c1', [snap('c1', 89, 0), snap('c1', 94, 20), snap('c1', 91, 10)])
    expect(g.score).toBe(89)
  })

  it('measures delta against the oldest reading inside the window', () => {
    const g = summarizeCourse('c1', [snap('c1', 94, 20), snap('c1', 91, 10), snap('c1', 89, 0)], 30)
    expect(g.delta).toBe(-5)
    expect(g.trend).toBe('down')
  })

  it('excludes readings older than the window from delta', () => {
    // The 60-day-old 70 must not count; inside 30 days the grade only moved 89 -> 90.
    const g = summarizeCourse('c1', [snap('c1', 70, 60), snap('c1', 89, 5), snap('c1', 90, 0)], 30)
    expect(g.delta).toBe(1)
  })

  it('returns a null delta when there is only one reading in the window', () => {
    const g = summarizeCourse('c1', [snap('c1', 88, 0)])
    expect(g.delta).toBeNull()
    expect(g.trend).toBe('new')
  })

  it('handles a course with no snapshots at all', () => {
    const g = summarizeCourse('missing', [snap('c1', 90, 0)])
    expect(g).toMatchObject({ score: null, delta: null, trend: 'new', points: [] })
  })

  it('drops null scores from the sparkline but keeps the reading', () => {
    const g = summarizeCourse('c1', [snap('c1', null, 5), snap('c1', 90, 0)])
    expect(g.points).toEqual([90])
  })

  it('ignores snapshots belonging to other courses', () => {
    const g = summarizeCourse('c1', [snap('c2', 10, 5), snap('c1', 90, 0)])
    expect(g.points).toEqual([90])
  })
})

describe('summarizeAll', () => {
  it('returns one row per requested course, including empty ones', () => {
    const rows = summarizeAll(['c1', 'c2'], [snap('c1', 90, 0)])
    expect(rows).toHaveLength(2)
    expect(rows[1]!.score).toBeNull()
  })
})

describe('gradeTone', () => {
  it('maps to the documented brand bands', () => {
    expect(gradeTone(95)).toBe('good')
    expect(gradeTone(90)).toBe('good')
    expect(gradeTone(85)).toBe('neutral')
    expect(gradeTone(75)).toBe('warn')
    expect(gradeTone(60)).toBe('bad')
    expect(gradeTone(null)).toBe('none')
  })
})

describe('mostMoved', () => {
  it('surfaces drops before rises, then by magnitude', () => {
    const grades = summarizeAll(
      ['up', 'downBig', 'downSmall', 'flat'],
      [
        snap('up', 80, 10), snap('up', 90, 0),
        snap('downBig', 95, 10), snap('downBig', 80, 0),
        snap('downSmall', 90, 10), snap('downSmall', 87, 0),
        snap('flat', 90, 10), snap('flat', 90, 0),
      ],
    )
    expect(mostMoved(grades).map((g) => g.courseId)).toEqual(['downBig', 'downSmall', 'up'])
  })

  it('leaves out courses that only moved by noise', () => {
    const grades = summarizeAll(['c1'], [snap('c1', 90, 10), snap('c1', 90.2, 0)])
    expect(mostMoved(grades)).toEqual([])
  })
})
