# Event Taxonomy

*Canonical names for every event emitted across Ledger's four observability layers. The taxonomy is shared so a single search (`auth.session.created`) finds matches in Pino logs, PostHog events, and the AuditLog table.*

*Last updated: 2026-05-28.*

---

## Convention

`<domain>.<action>.<outcome>`

- **domain** — broad subsystem: `auth`, `canvas`, `dashboard`, `audit`, `db`, …
- **action** — what happened: `session`, `sync`, `viewed`, `write`, …
- **outcome** — result modifier: `started`, `succeeded`, `failed`, `created`, `revoked`. Omitted only when the event is the action itself (e.g. `dashboard.viewed`).

**Adding a new event without an entry here is a code-review veto.** This file is the source of truth; `src/lib/analytics/events.ts` is the TypeScript projection.

---

## Events

### `audit`

| Event | When |
| --- | --- |
| `audit.write.succeeded` | An audit row was written. Debug-level, mostly for "did the helper run." |
| `audit.write.failed` | The audit insert threw. Captured to Sentry critical; caller is not blocked. |

### `auth` *(Milestone E)*

| Event | When |
| --- | --- |
| `auth.signin.requested` | A magic-link email was requested. PII redacted; only the user-id-after-lookup is recorded. |
| `auth.session.created` | A new session row was inserted (post-magic-link click). |
| `auth.session.revoked` | Explicit signout or admin-initiated revocation. |

### `canvas` *(Milestone F)*

| Event | When |
| --- | --- |
| `canvas.sync.started` | A sync attempt began. |
| `canvas.sync.succeeded` | Sync completed; `lastSyncedAt` bumped. |
| `canvas.sync.failed` | Sync failed; transaction rolled back. |
| `canvas.token.encrypted` | A new Canvas token was encrypted and stored. |
| `canvas.token.decrypted` | A Canvas token was decrypted at use time. Writes an audit row every time. |

### `dashboard` *(Milestone G)*

| Event | When |
| --- | --- |
| `dashboard.viewed` | The dashboard page rendered for an authenticated user. |

### `smoke` *(Milestone C — verification only)*

| Event | When |
| --- | --- |
| `smoke.logger.info` | `/api/_smoke/logger` was hit. Used to verify Pino → Better Stack. |
| `smoke.posthog.test` | `/api/_smoke/posthog` was hit. Used to verify PostHog ingestion. |
| `smoke.sentry.thrown` | `/api/_smoke/sentry` was hit. Used to verify Sentry ingestion. |

---

## When to emit to which layer

Not every event belongs in every layer. The pattern:

| Event class | Pino | PostHog | AuditLog | Sentry |
| --- | --- | --- | --- | --- |
| Server-side flow / request lifecycle | ✓ | — | — | only if it threw |
| User-facing action (click, page view, button) | — | ✓ | — | — |
| Sensitive action (token decrypt, post deletion, role change) | ✓ | — | ✓ | — |
| Auth events (signin / signout) | ✓ | ✓ | ✓ | — |
| Errors | ✓ (level=error) | — | only if sensitive | ✓ |

When in doubt, log to Pino. Audit is reserved for sensitive actions per FERPA. PostHog is reserved for product analytics — never PII.
