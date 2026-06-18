import { describe, expect, it } from 'vitest'
import { COURSE_PALETTE_SIZE, courseColorVar } from './courseColor'

describe('courseColorVar', () => {
  it('is deterministic for the same id', () => {
    expect(courseColorVar('course-abc')).toBe(courseColorVar('course-abc'))
  })

  it('returns a palette CSS var', () => {
    expect(courseColorVar('anything')).toMatch(/^var\(--color-course-[1-7]\)$/)
  })

  it('spreads ids across the palette (more than one, at most palette size)', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 200; i++) seen.add(courseColorVar(`course-${i}`))
    expect(seen.size).toBeGreaterThan(1)
    expect(seen.size).toBeLessThanOrEqual(COURSE_PALETTE_SIZE)
  })
})
