// Canonical event names. Add new ones in alphabetical order within their
// domain and document them in docs/observability/EVENTS.md before emitting.
//
// Convention: <domain>.<action>.<outcome>.
// All four observability layers share this taxonomy where possible.

export const EVENTS = {
  api: {
    // Emitted by the withApi wrapper (Milestone D onward).
    request_denied: 'api.request.denied',
    request_invalid: 'api.request.invalid',
    request_rate_limited: 'api.request.rate_limited',
  },
  audit: {
    write_succeeded: 'audit.write.succeeded',
    write_failed: 'audit.write.failed',
  },
  auth: {
    // Emitted from Milestone E onward.
    signin_requested: 'auth.signin.requested',
    session_created: 'auth.session.created',
    session_revoked: 'auth.session.revoked',
  },
  canvas: {
    // Emitted from Milestone F onward.
    sync_started: 'canvas.sync.started',
    sync_succeeded: 'canvas.sync.succeeded',
    sync_failed: 'canvas.sync.failed',
    token_encrypted: 'canvas.token.encrypted',
    token_decrypted: 'canvas.token.decrypted',
  },
  dashboard: {
    // Emitted from Milestone G onward.
    viewed: 'dashboard.viewed',
    study_guide_requested: 'dashboard.study_guide.requested',
  },
  onboarding: {
    // Emitted from Milestone E onward.
    completed: 'onboarding.completed',
  },
  smoke: {
    logger: 'smoke.logger.info',
    posthog: 'smoke.posthog.test',
    sentry: 'smoke.sentry.thrown',
  },
} as const

type AllEvents<T> = T extends string
  ? T
  : T extends Record<string, infer V>
    ? AllEvents<V>
    : never

export type EventName = AllEvents<typeof EVENTS>
