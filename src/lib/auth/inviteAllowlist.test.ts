import { afterEach, describe, expect, it, vi } from 'vitest'
import { canPasteCanvasToken } from './inviteAllowlist'

afterEach(() => vi.unstubAllEnvs())

describe('canPasteCanvasToken', () => {
  it('allows everyone when INVITE_ONLY is not "true"', () => {
    vi.stubEnv('INVITE_ONLY', '')
    expect(canPasteCanvasToken('anyone@example.com')).toBe(true)
    expect(canPasteCanvasToken(null)).toBe(true)
  })

  it('allows only allowlisted emails when INVITE_ONLY=true', () => {
    vi.stubEnv('INVITE_ONLY', 'true')
    vi.stubEnv('INVITE_ALLOWLIST', 'sam@ledger.dev, friend@ledger.dev')
    expect(canPasteCanvasToken('sam@ledger.dev')).toBe(true)
    expect(canPasteCanvasToken('stranger@ledger.dev')).toBe(false)
  })

  it('matches case- and whitespace-insensitively', () => {
    vi.stubEnv('INVITE_ONLY', 'true')
    vi.stubEnv('INVITE_ALLOWLIST', 'Sam@Ledger.Dev')
    expect(canPasteCanvasToken('  sam@ledger.dev ')).toBe(true)
  })

  it('denies when allowlist is empty or email is missing under INVITE_ONLY', () => {
    vi.stubEnv('INVITE_ONLY', 'true')
    vi.stubEnv('INVITE_ALLOWLIST', '')
    expect(canPasteCanvasToken('sam@ledger.dev')).toBe(false)
    expect(canPasteCanvasToken(null)).toBe(false)
  })
})
