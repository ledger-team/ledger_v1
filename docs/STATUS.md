# Ledger v2 — Status

*Living document. Updated as the foundation builds out. Source of truth for "what's actually working today."*

*Last updated: 2026-06-17.*

---

## Where we are

**Phase 0** — foundation build. No user-facing features yet. See [`PHASE_0_PLAN.md`](./PHASE_0_PLAN.md) for the milestone breakdown and verification checklist.

## Milestone progress

| Milestone | State | Notes |
| --- | --- | --- |
| **A. Repo & tooling** | ✅ Done | Next 15 + React 19 + TS strict + Tailwind v4 + Vitest. PR #1. |
| **B. Database foundation** | ✅ Done | Prisma 5 + Supabase + 16 tables with RLS on all of them. PR #2. Schema doc at `docs/db/SCHEMA.md`. |
| **C. Observability** | ✅ Done | Pino (stdout NDJSON) + Sentry (no source maps) + PostHog (browser + server) + AuditLog helper. RLS isolation test (11 cases) ships here. Runbook at `docs/observability/RUNBOOK.md`. Sentry verified end-to-end 2026-06-15 (SDK-captured `smoke: sentry test` confirmed in dashboard); instrumentation/Sentry config files moved under `src/` so Next 15's hook actually loads. |
| **D. Security primitives** | ✅ Done | AES-256-GCM encryption (`v2:` versioned format, AAD-ready, pure core) + `withApi` wrapper (auth + rate-limit + Zod, protected-by-default) + Upstash sliding-window limiter (dev fail-open / prod fail-closed) + HTTP security headers (CSP/HSTS/X-Frame-Options/etc) at `next.config.ts`. 28 tests. PR #4. |
| **E. Authentication** | ✅ Done | NextAuth v4 (database sessions) + Resend magic-link + Prisma adapter. Default-deny middleware (cookie-presence gate). `/login` + `/login/check-email`, two-step `/onboarding` (school + gradYear + name). `session.ts` internals swapped to NextAuth; `withApi` untouched. INVITE_ONLY gate. 15 tests. PR #5. |
| **F. Canvas sync** | ✅ Done | Typed Canvas client (`canvas.ts`, Link pagination, 401-distinct errors) + token storage (`token.ts`, D-module `v2:` base64url, AAD=userId, audited decrypts) + `syncUserCanvas`. Verified end-to-end against real DSISD Canvas (4 courses, 9 sections, 4 enrollments, 137 assignments). Sync writes use the **service-role** client (RLS-as-sync-write-path tracked as a follow-up); non-sync paths stay on `withSession`/RLS. Assignments upserted individually (pooler tx-timeout). 16 tests. PR #6. |
| **G. Dashboard feature** | 🟡 In progress | First plug-and-play feature folder (`src/features/dashboard/`). Upcoming assignments ("Next 7 days" / "Coming up") + per-course grades, dark-mode-primary, urgency cues + grade colors, study-guide stub. Reads via `withSession` (RLS isolation). PR open for review. |
| **G2. App shell + UI redesign** | 🟡 In progress | `(app)` route group with persistent nav (bottom tabs <768px / sidebar ≥768px): Home/Feed/Study/You. Redesigned home (time-aware greeting, scrolling grade pills, hero assignment cards w/ course-color dots, designed empty states). Feed/Study "coming soon"; You is functional (profile, Canvas status, theme, sign out, delete-account stub). Framer Motion (staggered entrance, tab cross-fade, reduced-motion honored). Tailwind v4 token surfaces (#1E1E21) + course-dot palette. RTL test harness added. **Stacked on G** — 13 new tests (112 total). PR open for review. |
| **H. FERPA delete** | 🟡 In progress | `deleteUserCompletely(userId)` (`src/lib/user/`): audit `user.deleted` first, then FK cascades + VerificationToken email-cleanup; `AuditLog.actorUserId` → SET NULL (row survives w/ `actorEmailHash`). Idempotent, service-role (auth enforced at the `deleteAccount` action via `session.user.id`). You-page delete button → accessible `<dialog>` (Esc cancels, Cancel-focused) → action → signOut → /login. Unit + live integration test (cascade + SET NULL verified). PR open for review. |
| **I. Testing & CI** | 🟡 In progress | GitHub Actions (`.github/workflows/ci.yml`): `quality` (lint + typecheck) gate → `test` + `build` in parallel. `test` runs the full suite (unit + integration) against a hermetic `postgres:16` service (migrate deploy + seed) — RLS/cascade tests run for real, no Supabase, no secrets. `build` runs env-free (dummy DB URLs for prisma generate; lazy Resend). pnpm store cached. Branch protection on `main` = manual step after first green run (gh command in PR). PR open for review. |
| **J. Production cutover** | 🟡 In progress | Code/config for cutover: Sentry source-map upload enabled (`next.config.ts`, build-time/token-gated); `/api/health` (public, `SELECT 1`) as the uptime target; brand assets in `public/brand/` + generated `icon`/`apple-icon`/`opengraph-image` (sharp script); `LedgerLoader` wired into onboarding sync wait. Runbooks `docs/runbooks/DEPLOY.md` + `SMOKE_TEST.md`. Launch on Vercel URL (real domain needed before inviting students — Resend can't verify `*.vercel.app`). Dashboard ops (Vercel/Supabase Pro/Resend/Better Stack/domain) are operator steps per DEPLOY.md. PR open for review. |

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
