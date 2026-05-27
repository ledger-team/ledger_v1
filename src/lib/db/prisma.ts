import { PrismaClient } from '@prisma/client'

// Service-role PrismaClient. Bypasses RLS because Prisma connects as the
// `postgres` superuser. Use sparingly:
//   - NextAuth's Prisma adapter (Milestone E)
//   - prisma/seed.ts and migration scripts
//   - One-off admin operations
//
// For everything else, use withSession() from ./withSession.ts — it runs
// the same client inside a transaction that switches to app_user and sets
// the request.jwt.claims so RLS policies apply.

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
