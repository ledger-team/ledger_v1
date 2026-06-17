import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { YouView } from './YouView'

describe('<YouView>', () => {
  it('renders session data, Canvas status, and the actions', () => {
    render(
      <YouView
        name="Samuel Berry"
        email="sam@ledger.test"
        schoolName="Dripping Springs High School"
        canvasConnected
        lastSyncedAt={new Date('2026-06-17T12:00:00Z')}
      />,
    )
    expect(screen.getByText('Samuel Berry')).toBeInTheDocument()
    expect(screen.getByText('sam@ledger.test')).toBeInTheDocument()
    expect(screen.getByText('Dripping Springs High School')).toBeInTheDocument()
    expect(screen.getByText(/Connected/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /delete account/i })).toBeInTheDocument()
  })

  it('shows "Not connected" when there is no Canvas token', () => {
    render(
      <YouView name="A B" email={null} schoolName="X" canvasConnected={false} lastSyncedAt={null} />,
    )
    expect(screen.getByText('Not connected')).toBeInTheDocument()
  })
})
