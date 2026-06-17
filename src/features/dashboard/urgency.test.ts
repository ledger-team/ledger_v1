import { describe, expect, it } from 'vitest'
import { classifyUrgency, gradeColor } from './urgency'

describe('classifyUrgency', () => {
  const now = new Date('2026-06-17T12:00:00Z')
  const hoursOut = (h: number) => new Date(now.getTime() + h * 3_600_000)

  it('< 24h → due_soon', () => {
    expect(classifyUrgency(hoursOut(1), now)).toBe('due_soon')
    expect(classifyUrgency(hoursOut(23.9), now)).toBe('due_soon')
    expect(classifyUrgency(hoursOut(-5), now)).toBe('due_soon') // overdue is urgent
  })

  it('24h–72h → this_week (boundaries)', () => {
    expect(classifyUrgency(hoursOut(24), now)).toBe('this_week')
    expect(classifyUrgency(hoursOut(71.9), now)).toBe('this_week')
  })

  it('>= 72h → normal', () => {
    expect(classifyUrgency(hoursOut(72), now)).toBe('normal')
    expect(classifyUrgency(hoursOut(240), now)).toBe('normal')
  })

  it('null due date → normal', () => {
    expect(classifyUrgency(null, now)).toBe('normal')
  })
})

describe('gradeColor', () => {
  it('maps score bands to tones (boundaries)', () => {
    expect(gradeColor(90)).toBe('accent')
    expect(gradeColor(93)).toBe('accent')
    expect(gradeColor(89.9)).toBe('foreground')
    expect(gradeColor(80)).toBe('foreground')
    expect(gradeColor(79.9)).toBe('warn')
    expect(gradeColor(70)).toBe('warn')
    expect(gradeColor(69.9)).toBe('urgent')
    expect(gradeColor(0)).toBe('urgent')
  })

  it('returns null when there is no score', () => {
    expect(gradeColor(null)).toBeNull()
    expect(gradeColor(undefined)).toBeNull()
  })
})
