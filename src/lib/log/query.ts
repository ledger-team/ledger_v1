// Cross-layer log query interface. The "one function hits all four sources"
// requirement from FOUNDATION § Cross-Layer.
//
// Phase 0 scope: only the AuditLog source is implemented (we own that DB).
// Sentry / PostHog / Better Stack sources throw NotImplementedInPhase0 with
// a clear pointer. They get wired up when the AI dev workflow actually
// needs them (Phase 2+ tool, not Phase 0).
//
// Adding a source later requires its respective API key and is documented
// in the file as a TODO.

import { prisma } from '@/lib/db/prisma'

export type LogSource = 'audit' | 'sentry' | 'posthog' | 'logs'

export type QueryFilter = {
  action?: string
  actorUserId?: string
  schoolId?: string
  // For non-audit sources later: text search, severity, event, etc.
}

export type QueryRange = {
  from: Date
  to: Date
}

export type QueryInput = {
  source: LogSource
  filter?: QueryFilter
  range?: QueryRange
  limit?: number
}

export class NotImplementedInPhase0 extends Error {
  constructor(source: LogSource) {
    super(
      `queryAll: source "${source}" not implemented in Phase 0. ` +
        `For now, use the ${dashboardName(source)} dashboard directly. ` +
        `Wired up when the AI dev workflow needs cross-layer queries (Phase 2+).`,
    )
    this.name = 'NotImplementedInPhase0'
  }
}

function dashboardName(source: LogSource): string {
  switch (source) {
    case 'sentry':
      return 'Sentry'
    case 'posthog':
      return 'PostHog'
    case 'logs':
      return 'Better Stack'
    default:
      return source
  }
}

export async function queryAll(input: QueryInput) {
  if (input.source === 'audit') {
    return prisma.auditLog.findMany({
      where: {
        ...(input.filter?.action ? { action: input.filter.action } : {}),
        ...(input.filter?.actorUserId ? { actorUserId: input.filter.actorUserId } : {}),
        ...(input.filter?.schoolId ? { schoolId: input.filter.schoolId } : {}),
        ...(input.range
          ? { createdAt: { gte: input.range.from, lte: input.range.to } }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: input.limit ?? 100,
    })
  }
  throw new NotImplementedInPhase0(input.source)
}
