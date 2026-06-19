// Default-deny middleware. Every route requires a session EXCEPT the public
// allowlist below.
//
// Database sessions can't be validated on the Edge (no DB, no JWT), so this only
// checks for the *presence* of the session cookie — a cheap gate that redirects
// obviously-unauthenticated requests. Real validation happens in Node via
// getServerSession() inside route handlers and server components (Plan §8 Q8).

import { NextResponse, type NextRequest } from 'next/server'

function isPublic(pathname: string): boolean {
  if (pathname === '/') return true
  if (pathname === '/login' || pathname.startsWith('/login/')) return true
  if (pathname.startsWith('/api/auth')) return true
  if (pathname.startsWith('/api/smoke')) return true // dev-only routes; they self-404 in prod
  if (pathname.startsWith('/api/health')) return true // uptime probe
  return false
}

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl
  if (isPublic(pathname)) return NextResponse.next()

  const hasSession =
    req.cookies.has('next-auth.session-token') ||
    req.cookies.has('__Secure-next-auth.session-token')

  if (!hasSession) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  // Run on everything except Next internals and static asset files.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
