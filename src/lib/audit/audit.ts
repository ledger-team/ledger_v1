import { createHash } from 'node:crypto'
import * as Sentry from '@sentry/nextjs'
import { logger } from '@/lib/log/logger'
import { prisma } from '@/lib/db/prisma'

/**
 * Audit log helper. Writes one row per sensitive action.
 *
 * Failure mode: fail-open + critical alert. If the audit write throws (DB
 * unreachable, schema drift, RLS misconfiguration), the caller is NOT
 * blocked — we log the failure to Pino, capture it in Sentry as critical,
 * and return. Per the Phase 0 plan § 5 ("Open testing question"), fail-open
 * is the chosen default. Rationale: a transient DB issue should not log
 * everyone out or fail every API call; the missed audit event is logged
 * separately so it's not invisible.
 *
 * The actor's email is hashed (SHA-256, hex) and stored alongside actorUserId.
 * The hash survives `deleteUserCompletely()` (where actorUserId becomes NULL)
 * and gives forensic continuity without retaining PII.
 *
 * This helper uses the service-role Prisma client (bypasses RLS). The caller
 * is trusted to pass the correct actorUserId. The RLS-enforced path is
 * tested separately in src/lib/db/__tests__/rls.test.ts to ensure direct
 * inserts from app_user context still respect the policy.
 */

export type AuditInput = {
  action: string
  actorUserId?: string | null
  schoolId?: string | null
  targetType?: string | null
  targetId?: string | null
  metadata?: Record<string, unknown>
  ipAddress?: string | null
  userAgent?: string | null
}

export function hashEmail(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex')
}

export async function log(input: AuditInput): Promise<void> {
  try {
    let actorEmailHash: string | null = null
    if (input.actorUserId) {
      const user = await prisma.user.findUnique({
        where: { id: input.actorUserId },
        select: { email: true },
      })
      if (user?.email) actorEmailHash = hashEmail(user.email)
    }

    await prisma.auditLog.create({
      data: {
        action: input.action,
        actorUserId: input.actorUserId ?? null,
        actorEmailHash,
        schoolId: input.schoolId ?? null,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        metadata: (input.metadata ?? {}) as object,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    })

    logger.debug({ event: 'audit.write.succeeded', action: input.action })
  } catch (err) {
    // Fail-open: don't propagate. Alert loudly so the gap is visible.
    logger.error(
      {
        event: 'audit.write.failed',
        action: input.action,
        actorUserId: input.actorUserId,
        err: err instanceof Error ? err.message : String(err),
      },
      'audit write failed — alerting Sentry',
    )
    Sentry.captureException(err, {
      level: 'fatal',
      tags: { domain: 'audit' },
      extra: { action: input.action, actorUserId: input.actorUserId },
    })
  }
}

export const audit = { log, hashEmail }
