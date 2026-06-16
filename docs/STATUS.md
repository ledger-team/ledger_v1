# Ledger v2 — Status

*Living document. Updated as the foundation builds out. Source of truth for "what's actually working today."*

*Last updated: 2026-06-16.*

---

## Where we are

**Phase 0** — foundation build. No user-facing features yet. See [`PHASE_0_PLAN.md`](./PHASE_0_PLAN.md) for the milestone breakdown and verification checklist.

## Milestone progress

| Milestone | State | Notes |
| --- | --- | --- |
| **A. Repo & tooling** | ✅ Done | Next 15 + React 19 + TS strict + Tailwind v4 + Vitest. PR #1. |
| **B. Database foundation** | ✅ Done | Prisma 5 + Supabase + 16 tables with RLS on all of them. PR #2. Schema doc at `docs/db/SCHEMA.md`. |
| **C. Observability** | ✅ Done | Pino (stdout NDJSON) + Sentry (no source maps) + PostHog (browser + server) + AuditLog helper. RLS isolation test (11 cases) ships here. Runbook at `docs/observability/RUNBOOK.md`. Sentry verified end-to-end 2026-06-15 (SDK-captured `smoke: sentry test` confirmed in dashboard); instrumentation/Sentry config files moved under `src/` so Next 15's hook actually loads. |
| **D. Security primitives** | 🟡 In progress | AES-256-GCM encryption (`v2:` versioned format, AAD-ready, pure core) + `withApi` wrapper (auth + rate-limit + Zod, protected-by-default) + Upstash sliding-window limiter (dev fail-open / prod fail-closed) + HTTP security headers (CSP/HSTS/X-Frame-Options/etc) at `next.config.ts`. 28 new tests. PR open for review. |
| **E. Authentication** | 🟡 In progress | NextAuth v4 (database sessions) + Resend magic-link + Prisma adapter. Default-deny middleware (cookie-presence gate). `/login` + `/login/check-email`, two-step `/onboarding` (school + gradYear + name; Canvas paste is a gated stub — saving lands in F), `/dashboard` placeholder showing real session data. `session.ts` internals swapped to NextAuth; `withApi` untouched. INVITE_ONLY gate. 15 new tests. PR open for review. |
| **F. Canvas sync** | ⬜ Not started | Invite-only token-paste; full sync pipeline |
| **G. Dashboard feature** | ⬜ Not started | First plug-and-play feature folder |
| **H. FERPA delete** | ⬜ Not started | `deleteUserCompletely` + UI |
| **I. Testing & CI** | ⬜ Not started | GitHub Actions: lint + typecheck + tests |
| **J. Production cutover** | ⬜ Not started | Vercel deploy + Supabase Pro + Better Stack uptime |

## What's working today

Nothing user-facing. The app boots to a placeholder landing page that says "Phase 0 build in progress." The infrastructure being built around it is what matters in Phase 0.

## What's not working

- All 15 of FOUNDATION.md's done criteria are unmet. See `PHASE_0_PLAN.md` § 7 for the verification checklist.

## Open decisions

None at the moment — all decisions from `PHASE_0_PLAN.md` § 1 have been resolved. Future decisions will be logged here.

## How to update this file

After every milestone PR merges:
- Flip the milestone's state to ✅
- Move the next milestone to 🟡 In progress
- Add notable surprises / open follow-ups under that milestone
