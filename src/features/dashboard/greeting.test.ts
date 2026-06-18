import { describe, expect, it } from 'vitest'
import { pickGreeting } from './greeting'

const at = (h: number) => new Date(2026, 5, 17, h, 0, 0) // local time; getHours() === h

describe('pickGreeting', () => {
  it('morning bucket (5–12) rotates', () => {
    expect(pickGreeting('Sam', at(5), () => 0)).toBe('Morning, Sam')
    expect(pickGreeting('Sam', at(8), () => 0.99)).toBe('Rise and grind, Sam')
    expect(pickGreeting('Sam', at(11), () => 0)).toBe('Morning, Sam')
  })

  it('afternoon bucket (12–17) rotates', () => {
    expect(pickGreeting('Sam', at(12), () => 0)).toBe('Afternoon, Sam')
    expect(pickGreeting('Sam', at(16), () => 0.99)).toBe('Hey, Sam')
  })

  it('evening bucket (17–21)', () => {
    expect(pickGreeting('Sam', at(17), () => 0)).toBe('Evening, Sam')
    expect(pickGreeting('Sam', at(20), () => 0.99)).toBe('Evening, Sam')
  })

  it('late bucket (21–5) rotates and wraps midnight', () => {
    expect(pickGreeting('Sam', at(21), () => 0)).toBe('Up late, Sam?')
    expect(pickGreeting('Sam', at(23), () => 0.99)).toBe('Burning the midnight oil, Sam')
    expect(pickGreeting('Sam', at(0), () => 0)).toBe('Up late, Sam?')
    expect(pickGreeting('Sam', at(4), () => 0)).toBe('Up late, Sam?')
  })
})
