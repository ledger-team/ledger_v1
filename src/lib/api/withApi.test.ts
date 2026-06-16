import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// Mock the two collaborators so these stay pure unit tests (no auth, no Redis).
vi.mock('@/lib/auth/session', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/rate-limit/limiter', () => ({ limit: vi.fn() }))

import { withApi } from './withApi'
import { getServerSession, type AppSession } from '@/lib/auth/session'
import { limit } from '@/lib/rate-limit/limiter'

const mockedSession = vi.mocked(getServerSession)
const mockedLimit = vi.mocked(limit)

function appSession(user: Partial<AppSession['user']> & { id: string }): AppSession {
  return {
    user: { email: null, name: null, schoolId: null, gradYear: null, onboarded: false, ...user },
  }
}

function req(body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/test', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.5' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

beforeEach(() => {
  mockedSession.mockResolvedValue(null)
  mockedLimit.mockResolvedValue({ success: true, limit: 60, remaining: 59, reset: Date.now() + 60_000 })
})
afterEach(() => vi.clearAllMocks())

describe('withApi', () => {
  it('returns 401 when unauthenticated and the route is not public', async () => {
    const handler = withApi({}, async () => NextResponse.json({ ok: true }))
    const res = await handler(req())
    expect(res.status).toBe(401)
  })

  it('runs the handler without a session when public', async () => {
    const handler = withApi({ public: true }, async ({ session }) => NextResponse.json({ session }))
    const res = await handler(req())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ session: null })
  })

  it('returns 429 with a Retry-After header when rate limited', async () => {
    mockedLimit.mockResolvedValue({ success: false, limit: 10, remaining: 0, reset: Date.now() + 5_000 })
    const handler = withApi({ public: true }, async () => NextResponse.json({ ok: true }))
    const res = await handler(req())
    expect(res.status).toBe(429)
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0)
  })

  it('returns 400 with issues when the body fails schema validation', async () => {
    mockedSession.mockResolvedValue(appSession({ id: 'u1' }))
    const handler = withApi(
      { schema: z.object({ name: z.string().min(1) }) },
      async ({ data }) => NextResponse.json({ data }),
    )
    const res = await handler(req({ name: '' }))
    expect(res.status).toBe(400)
    expect((await res.json()).issues).toBeDefined()
  })

  it('passes the parsed body and session to the handler on success', async () => {
    mockedSession.mockResolvedValue(appSession({ id: 'u1', schoolId: 's1' }))
    const handler = withApi(
      { schema: z.object({ name: z.string() }) },
      async ({ data, session }) => NextResponse.json({ name: data.name, uid: session?.user.id }),
    )
    const res = await handler(req({ name: 'ledger' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ name: 'ledger', uid: 'u1' })
  })

  it('keys the rate limit by user id when authenticated', async () => {
    mockedSession.mockResolvedValue(appSession({ id: 'user-42' }))
    const handler = withApi({}, async () => NextResponse.json({ ok: true }))
    await handler(req())
    expect(mockedLimit).toHaveBeenCalledWith(expect.stringContaining('user-42'), 'api')
  })

  it('skips rate limiting entirely when rateLimit is false', async () => {
    const handler = withApi({ public: true, rateLimit: false }, async () => NextResponse.json({ ok: true }))
    await handler(req())
    expect(mockedLimit).not.toHaveBeenCalled()
  })
})
