// FERPA delete path. Permanently removes a user and all their data.
//
// Uses the service-role Prisma client by necessity (NOT withSession): the FK
// cascades hit tables where app_user has no DELETE policy (Account, Session,
// DailyLimit) or no access at all (VerificationToken), and the AuditLog
// actorUserId SET NULL cascade is an UPDATE that is REVOKED from app_user. The
// authorization boundary is the caller (the deleteAccount action only ever passes
// session.user.id) — never a client-supplied id.
//
// Cascade map: docs/db/SCHEMA.md § "Cascade map (FERPA delete path)".

import { prisma } from '@/lib/db/prisma'
import { audit } from '@/lib/audit/audit'
import { logger } from '@/lib/log/logger'
import { EVENTS } from '@/lib/analytics/events'

export async function deleteUserCompletely(userId: string): Promise<{ deleted: boolean }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, schoolId: true },
  })

  // Idempotent: a second call (user already gone) is a no-op.
  if (!user) return { deleted: false }

  // Audit BEFORE deletion — the user must still exist to be referenced. The
  // user.delete below then SET-NULLs actorUserId on this very row, leaving
  // actorEmailHash for forensic continuity (the row survives the user).
  await audit.log({
    action: EVENTS.user.deleted,
    actorUserId: user.id,
    schoolId: user.schoolId,
    targetType: 'User',
    targetId: user.id,
  })

  // VerificationToken has no FK to User (keyed by email) — the cascade misses it.
  // Delete by identifier for a complete wipe (docs/db/SCHEMA.md cascade map).
  await prisma.verificationToken.deleteMany({ where: { identifier: user.email } })

  // Deletes the user; FK cascades remove Account, Session, CanvasToken,
  // Enrollment, Post (authored, + child comments/Reactions/Reports), Reaction,
  // Report, StudyGuide, DailyLimit. AuditLog.actorUserId → SET NULL.
  await prisma.user.delete({ where: { id: userId } })

  logger.info({ event: EVENTS.user.deleted, userId }, 'user deleted (FERPA delete path)')
  return { deleted: true }
}
