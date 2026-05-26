# Ledger v2 — Status

*Living document. Updated as the foundation builds out. Source of truth for "what's actually working today."*

*Last updated: 2026-05-26.*

---

## Where we are

**Phase 0** — foundation build. No user-facing features yet. See [`PHASE_0_PLAN.md`](./PHASE_0_PLAN.md) for the milestone breakdown and verification checklist.

## Milestone progress

| Milestone | State | Notes |
| --- | --- | --- |
| **A. Repo & tooling** | 🟡 In progress | Next 15 + React 19 + TS strict + Tailwind v4 + Vitest scaffold |
| **B. Database foundation** | ⬜ Not started | Prisma + Supabase + RLS migrations |
| **C. Observability** | ⬜ Not started | Pino + Sentry + PostHog + AuditLog helper |
| **D. Security primitives** | ⬜ Not started | AES-256-GCM, withApi wrapper, Upstash rate limit |
| **E. Authentication** | ⬜ Not started | NextAuth + Resend magic link |
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
