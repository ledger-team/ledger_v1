import { beforeEach, describe, expect, it, vi } from 'vitest'

// Real encryption module (uses ENCRYPTION_KEY from .env via test setup); prisma
// and audit are mocked.
vi.mock('@/lib/db/prisma', () => ({
  prisma: { canvasToken: { upsert: vi.fn(), findUnique: vi.fn() } },
}))
vi.mock('@/lib/audit/audit', () => ({ audit: { log: vi.fn() } }))

import { getDecryptedToken, saveToken } from './token'
import { prisma } from '@/lib/db/prisma'
import { audit } from '@/lib/audit/audit'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any

// Capture whatever saveToken would persist, so getDecryptedToken can read it back.
function captureStored(): () => string {
  let stored = ''
  p.canvasToken.upsert.mockImplementation((arg: { create: { encryptedToken: string } }) => {
    stored = arg.create.encryptedToken
    return Promise.resolve({})
  })
  return () => stored
}

beforeEach(() => vi.clearAllMocks())

describe('saveToken', () => {
  it('stores the v2 base64url ciphertext and audits the encryption', async () => {
    const stored = captureStored()
    await saveToken('user-1', 'canvas-secret')
    expect(stored()).toMatch(/^v2:[A-Za-z0-9_-]+$/)
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'canvas.token.encrypted', actorUserId: 'user-1' }),
    )
  })
})

describe('getDecryptedToken', () => {
  it('round-trips a saved token and audits the decryption', async () => {
    const stored = captureStored()
    await saveToken('user-1', 'my-canvas-token')
    p.canvasToken.findUnique.mockResolvedValue({ encryptedToken: stored() })

    const out = await getDecryptedToken('user-1')
    expect(out).toBe('my-canvas-token')
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'canvas.token.decrypted', actorUserId: 'user-1' }),
    )
  })

  it('binds ciphertext to the user via AAD — a different user cannot decrypt', async () => {
    const stored = captureStored()
    await saveToken('user-1', 'my-canvas-token')
    p.canvasToken.findUnique.mockResolvedValue({ encryptedToken: stored() })
    await expect(getDecryptedToken('user-2')).rejects.toThrow()
  })

  it('returns null when no token is stored', async () => {
    p.canvasToken.findUnique.mockResolvedValue(null)
    expect(await getDecryptedToken('user-1')).toBeNull()
  })
})
