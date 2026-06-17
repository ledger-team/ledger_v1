import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NAV_ITEMS, isActive } from './nav'

const state = vi.hoisted(() => ({ pathname: '/home' }))
vi.mock('next/navigation', () => ({ usePathname: () => state.pathname }))

import { AppNav } from './AppNav'

describe('nav model', () => {
  it('has the four destinations in order', () => {
    expect(NAV_ITEMS.map((i) => i.href)).toEqual(['/home', '/feed', '/study', '/you'])
  })

  it('isActive matches exact and nested paths only', () => {
    expect(isActive('/home', '/home')).toBe(true)
    expect(isActive('/home/x', '/home')).toBe(true)
    expect(isActive('/feed', '/home')).toBe(false)
  })
})

describe('<AppNav>', () => {
  beforeEach(() => {
    state.pathname = '/feed'
  })

  it('renders all four tabs (sidebar + bottom bar)', () => {
    render(<AppNav userName="Sam Berry" />)
    for (const label of ['Home', 'Feed', 'Study', 'You']) {
      expect(screen.getAllByRole('link', { name: new RegExp(label, 'i') }).length).toBeGreaterThanOrEqual(1)
    }
  })

  it('marks only the active tab with aria-current', () => {
    render(<AppNav userName="Sam Berry" />)
    expect(
      screen.getAllByRole('link', { name: /feed/i }).every((l) => l.getAttribute('aria-current') === 'page'),
    ).toBe(true)
    expect(
      screen.getAllByRole('link', { name: /home/i }).every((l) => l.getAttribute('aria-current') !== 'page'),
    ).toBe(true)
  })
})
