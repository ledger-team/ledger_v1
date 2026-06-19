import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

// Uptime target (Better Stack pings this, not /home which 307-redirects when
// unauthenticated). Public, no auth, never cached. A green response means the app
// AND the database are reachable — not just "the process is alive".
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: 'ok', db: 'ok' })
  } catch {
    return NextResponse.json({ status: 'error', db: 'down' }, { status: 503 })
  }
}
