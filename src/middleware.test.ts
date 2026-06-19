import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from './middleware'

function reqFor(path: string, withCookie = false): NextRequest {
  return new NextRequest(
    `http://localhost${path}`,
    withCookie ? { headers: { cookie: 'next-auth.session-token=abc123' } } : undefined,
  )
}

describe('default-deny middleware', () => {
  it('lets public routes through without a session', () => {
    expect(middleware(reqFor('/login')).headers.get('location')).toBeNull()
    expect(middleware(reqFor('/')).headers.get('location')).toBeNull()
  })

  it('treats /api/auth, /api/smoke, and /api/health as public', () => {
    expect(middleware(reqFor('/api/auth/session')).headers.get('location')).toBeNull()
    expect(middleware(reqFor('/api/smoke/sentry')).headers.get('location')).toBeNull()
    expect(middleware(reqFor('/api/health')).headers.get('location')).toBeNull()
  })

  it('redirects a protected route to /login when no session cookie is present', () => {
    const res = middleware(reqFor('/home'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
    expect(res.headers.get('location')).toContain('callbackUrl')
  })

  it('lets a protected route through when a session cookie is present', () => {
    expect(middleware(reqFor('/home', true)).headers.get('location')).toBeNull()
  })
})
