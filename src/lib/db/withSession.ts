import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'

export type SessionClaims = {
  user_id: string
  school_id?: string | null
}

/**
 * Runs `fn` inside a transaction whose Postgres role is `app_user` and whose
 * `request.jwt.claims` setting reflects the caller's session. This is the
 * RLS-enforced path — every server query that depends on user identity
 * should go through this wrapper.
 *
 * Mechanics:
 *   BEGIN;
 *   SET LOCAL ROLE app_user;
 *   SET LOCAL request.jwt.claims = '{"user_id":"...","school_id":"..."}';
 *   <fn runs here, queries are RLS-checked>
 *   COMMIT;
 *
 * `SET LOCAL` reverts at commit/rollback, so no state leaks between requests.
 *
 * Notes:
 * - `prisma.$transaction(async tx => ...)` is required; the SET LOCAL must
 *   execute on the same connection as `fn`'s queries, which is only
 *   guaranteed inside a transaction.
 * - We use $executeRawUnsafe because `SET` syntax doesn't accept parameter
 *   binding ($1). The role name is a literal we control; the claims JSON
 *   is built from values we control (passed in by the caller, which itself
 *   sources them from the authenticated session, never from user input).
 *   Single quotes inside the JSON are escaped Postgres-style as a defense.
 */
export async function withSession<T>(
  claims: SessionClaims,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET LOCAL ROLE app_user')

    const payload = JSON.stringify(claims).replace(/'/g, "''")
    await tx.$executeRawUnsafe(`SET LOCAL request.jwt.claims = '${payload}'`)

    return fn(tx)
  })
}
