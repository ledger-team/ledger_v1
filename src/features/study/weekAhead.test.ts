import { describe, expect, it } from 'vitest'
import { busiestDay, groupByDay, overdue, type UpcomingAssignment } from './weekAhead'

// Fixed clock so day-boundary math is deterministic. Midday avoids DST edges.
const NOW = new Date('2026-09-15T12:00:00')
const inDays = (n: number, hour = 9) => {
  const d = new Date(NOW)
  d.setDate(d.getDate() + n)
  d.setHours(hour, 0, 0, 0)
  return d
}

const a = (id: string, dueAt: Date | null, points: number | null = 10): UpcomingAssignment => ({
  id,
  name: id,
  dueAt,
  pointsPossible: points,
  course: { id: 'c1', name: 'AP Physics 1' },
})

describe('groupByDay', () => {
  it('keeps empty days so a free evening is visible', () => {
    const buckets = groupByDay([a('x', inDays(2))], 7, NOW)
    expect(buckets).toHaveLength(7)
    expect(buckets[1]!.items).toEqual([])
    expect(buckets[2]!.items).toHaveLength(1)
  })

  it('marks today', () => {
    const buckets = groupByDay([], 7, NOW)
    expect(buckets[0]!.isToday).toBe(true)
    expect(buckets[1]!.isToday).toBe(false)
  })

  it('buckets by calendar day, not by 24-hour offset', () => {
    // 11pm tonight is still today, even though it is < 24h away.
    const buckets = groupByDay([a('late', inDays(0, 23))], 7, NOW)
    expect(buckets[0]!.items).toHaveLength(1)
  })

  it('sums points per day', () => {
    const buckets = groupByDay([a('x', inDays(1), 100), a('y', inDays(1), 210)], 7, NOW)
    expect(buckets[1]!.totalPoints).toBe(310)
  })

  it('treats a missing point value as zero rather than NaN', () => {
    const buckets = groupByDay([a('x', inDays(1), null)], 7, NOW)
    expect(buckets[1]!.totalPoints).toBe(0)
  })

  it('drops assignments outside the window and those with no due date', () => {
    const buckets = groupByDay([a('far', inDays(30)), a('none', null), a('past', inDays(-3))], 7, NOW)
    expect(buckets.every((b) => b.items.length === 0)).toBe(true)
  })

  it('orders items within a day by time', () => {
    const buckets = groupByDay([a('pm', inDays(1, 15)), a('am', inDays(1, 8))], 7, NOW)
    expect(buckets[1]!.items.map((i) => i.id)).toEqual(['am', 'pm'])
  })
})

describe('busiestDay', () => {
  it('picks the heaviest day by points, not by count', () => {
    const buckets = groupByDay(
      [a('one', inDays(1), 300), a('two', inDays(2), 10), a('three', inDays(2), 10)],
      7,
      NOW,
    )
    expect(busiestDay(buckets)!.totalPoints).toBe(300)
  })

  it('returns null for an empty week', () => {
    expect(busiestDay(groupByDay([], 7, NOW))).toBeNull()
  })
})

describe('overdue', () => {
  it('returns past-due work newest first and ignores undated items', () => {
    const list = overdue([a('old', inDays(-5)), a('recent', inDays(-1)), a('none', null)], NOW)
    expect(list.map((i) => i.id)).toEqual(['recent', 'old'])
  })
})
