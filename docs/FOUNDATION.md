# Ledger v2 — Foundation Spec

*Conceptual requirements for Ledger v2. Not code-specific. This is the "what we want and why" document, not the "how to write it" document.*

*Last updated: May 25, 2026.*

---

## Purpose of this Document

Ledger v1 was a prototype that proved Canvas integration works and validated the schema design. v2 is the real codebase that will reach mid-August 2026 launch and scale beyond it.

The single most important thing about v2 is that it's **foundation-first**. v1 grew feature-by-feature with the infrastructure patched in retroactively. v2 starts with infrastructure done right, and then features become plug-and-play on top.

This document defines what "done right" means for the foundation. It's intentionally non-code-specific because the implementation details will change — but the principles below should not.

---

## Product Identity (Reaffirmed)

**Ledger is the operating system for high school life.** Canvas-synced study app + social platform for students. The vision: "high school, online."

**Students only. Forever.** No faculty, no administration, no parents, no admins-of-any-kind. The single most powerful thing about Ledger is that it's *theirs*. The moment an adult can log in, students stop posting honestly and the platform dies.

**Pure consumer subscription business.** Free tier + Ledger Plus ($6.99-9.99/mo). No district licensing, no school contracts, no ad revenue. Like Spotify or Duolingo — pay for premium, free forever for the rest.

**Multi-school by default.** Dripping Springs High is the launch school, but v2 must support any school from line one. No hardcoded school IDs anywhere.

**Minors as users.** This is a legal reality, not a marketing detail. FERPA applies. Data handling has to be auditable. Account deletion has to actually work.

---

## Encryption Requirements

**Canvas tokens are the most sensitive data Ledger holds.** They grant full access to a student's real academic record at their real school. Treat them like credit card numbers.

- **All Canvas tokens are encrypted at rest with AES-256-GCM.** This pattern was validated in v1 and is the right choice. 256-bit key, random 16-byte IV per ciphertext, authenticated with the GCM tag. No exceptions, no "we'll encrypt it later."

- **Encryption keys live only in environment variables.** Never in code, never in the database, never in logs. The key is generated once per environment (dev, prod) and rotated only if compromised.

- **Tokens are decrypted only at the moment they're used.** Not cached in memory longer than necessary, not held in long-running variables, not logged for debugging.

- **Token decryption is an audited action.** Every decryption writes an audit log entry (who, when, why). This matters for FERPA — if a parent or auditor asks who accessed a child's data, we need to answer.

- **All database connections use TLS.** Supabase enforces this; no opt-out.

- **All HTTP traffic uses HTTPS.** No exceptions. Vercel handles this in production; local dev runs over HTTP only on localhost.

- **Passwords are never stored.** Authentication is passwordless (magic link or OAuth). There is no "forgot password" flow because there's nothing to forget.

---

## Database Management Philosophy

The v1 pain point: schema changes happened by copy-pasting SQL into Supabase's web editor. This worked but was fragile, untracked, and not reproducible. v2 fixes this completely.

- **All schema changes are managed via Prisma's migrate workflow.** Every schema change generates a migration file. Every migration file is committed to the repository. The migration history is the source of truth.

- **No SQL is ever pasted into the Supabase editor for schema changes.** If a migration needs to happen, it goes through `prisma migrate dev` locally and `prisma migrate deploy` in production. If we can't make it work through Prisma, we figure out why and fix it — we don't work around it.

- **Migrations are runnable from any environment via the terminal.** Local dev, CI, production. Same command, different target. A new developer (or a fresh agent session) should be able to clone the repo and bring up a complete database with one command.

- **A `db:reset` command exists for local dev.** Nukes the local database and reseeds it with realistic test data. This is critical for iteration speed.

- **Test data is clearly separated from real data.** Every seeded row carries a flag (`isTestData` or equivalent) so it can be wiped cleanly when real data takes over. This pattern from v1 was correct and continues into v2.

- **Multi-school by default.** Every query that touches user data is school-scoped from the session, not from environment variables. The user's school is derived from their authentication, never hardcoded. v1's `CANVAS_BASE_URL` env var pattern does not exist in v2.

- **Row Level Security (RLS) is enabled on every table from migration #1.** Not "we'll add RLS later." RLS policies live in migration files alongside table definitions. Application-level filtering remains the primary safety mechanism, but RLS is the defense-in-depth layer that catches bugs.

- **Foreign keys are real and enforced.** Every relation has a proper foreign key constraint with the correct cascade behavior. Deleting a user cascades to their posts, study guides, enrollments, and audit logs. No orphan rows.

- **Indexes are added intentionally.** Every query path that hits a table by something other than its primary key has a supporting index. This is set up from the start, not patched in when things get slow.

---

## Authentication & Sessions

- **Magic link email auth is the primary login mechanism for v2's first weeks.** Until Dripping Springs ISD approves a Canvas developer key for OAuth, students sign in with email and connect Canvas separately via OAuth (not token-paste).

- **Canvas OAuth is the eventual goal.** When the developer key is approved, the login flow becomes "Sign in with Canvas" — one tap, no email needed. The user model and session architecture must support this swap without rewriting downstream code.

- **No token-paste flow in v2.** v1 had students paste Canvas tokens during onboarding. This was acceptable for a 5-user dev period. It is unacceptable for real users — most students don't know how to generate a token, tokens have full account access, and it's a security education problem we don't want to own.

- **Sessions are stored server-side in the database.** Not JWT-only. This means we can revoke a session immediately if needed (compromised account, account deletion, etc.).

- **Sessions last 30 days by default.** Long enough that students aren't constantly re-logging in. Short enough that abandoned accounts don't stay logged in forever.

- **Middleware protects every authenticated route by default.** The default is "this route requires a session." Public routes (login, marketing pages, health checks) are explicitly listed as exceptions. v1's pattern of "the dashboard is public and reads a hardcoded user ID" is permanently impossible in v2 because there's nothing to read.

- **No hardcoded user IDs anywhere in the codebase.** The session user ID is the source of truth for every authenticated query. If you ever see `const USER_ID = "abc..."` in v2 code, that's a bug.

- **The audit log records every authentication event.** Logins, logouts, session creations, session revocations. This is FERPA-relevant and useful for debugging "why am I suddenly logged out" issues.

---

## Plug-and-Play Feature Architecture

This is the single most important architectural requirement for v2. Every feature in the roadmap (Hype Feed, Pulse, Class Feeds, Grade Predictor, School Bracket, The Fit, Senior Wall) must be addable without touching existing code. The foundation supports the features; the features don't reach into the foundation.

- **Features live in isolated module folders.** Each feature has its own folder containing its schema additions, API routes, UI components, server queries, and tests. Nothing leaks across.

- **Features depend on shared infrastructure, not on each other.** Shared infrastructure includes: auth, database access, Canvas sync, API wrappers (auth check + rate limit + validation), logging, feature flags. Features import from shared infrastructure; they do not import from each other.

- **Schema additions are per-feature.** Each feature contributes its own tables to the schema. When Hype Feed launches, it adds a Hype Feed-specific table (or polymorphic association on a shared posts table). It does not modify existing tables.

- **A central feature flag system exists from day one.** Every feature can be toggled on/off per environment, per school, and per user. This means Hype Feed can launch to Dripping Springs only, then roll out to other schools when ready. It also means a buggy feature can be killed instantly without deploying.

- **Adding a new feature should be a predictable amount of work.** One folder, one schema migration, a handful of API routes, a handful of components, a handful of tests. If adding a feature requires touching the foundation, the foundation is wrong and needs to be fixed first.

- **The schema design anticipates social features without locking them in.** A generic `Post` table with polymorphic association ("this post belongs to AP World Section 3" OR "this post is in Dripping Springs Hype Feed" OR "this post is a comment on a Hype post") is the right pattern. One table, many feed types. Reactions, reports, anonymous posting, and threading apply uniformly across feed types.

---

## Monitoring, Logging, and Observability

Every action, time, interaction, error, and event in Ledger is monitored and easily reviewable. This is not optional — it's foundational. The data only matters if it's there from the beginning, and it has to be there because Ledger handles minors' educational data and is run by a solo founder who can't be in production 24/7.

There are four distinct layers, and all four are set up in Phase 0.

### Layer 1: Application Logging

- **Structured logging on every server action.** Every meaningful event (request started, sync ran, study guide generated, error caught) emits a log entry with a timestamp, severity, event name, user context, and optional payload.

- **Event names follow a consistent taxonomy.** The convention is `<domain>.<action>.<outcome>` — for example `canvas.sync.started`, `auth.session.created`, `study_guide.generation.failed`. New features must follow this taxonomy.

- **Local development logs go to a pretty-printed terminal.** Developers see what's happening in real time without setup friction.

- **Production logs ship to a queryable aggregator** (Better Stack, Axiom, or equivalent). Free tier is sufficient for launch volume. The aggregator must support full-text search and have an API that allows AI agents to query the logs.

- **Sensitive data never goes in logs.** No Canvas tokens, no encryption keys, no email addresses in plaintext if avoidable. PII appears in audit logs (separate table) — not in application logs.

### Layer 2: Error Tracking

- **Every uncaught error is reported to Sentry.** Both server-side and client-side. Source maps are uploaded so stack traces are readable.

- **Sentry is initialized at application startup**, not buried in individual feature modules. Errors thrown anywhere in the codebase are caught.

- **Error reports include user context where available.** User ID, school, request route, and a breadcrumb trail of what happened in the seconds before the error. This is the difference between a useful error report and a useless one.

- **Performance traces are enabled.** Slow queries, slow API routes, slow page loads all surface in Sentry. This is how we catch problems before users complain.

### Layer 3: Product Analytics

- **PostHog (or equivalent) tracks user behavior.** Page views, button clicks, feature usage, retention curves, funnels.

- **Event taxonomy is consistent and documented.** Events like `study_guide.generated`, `hype_feed.post.created`, `plus_upgrade.started` follow the same naming pattern across features. A document in the repo defines the canonical event names.

- **No PII in analytics events.** User IDs are okay; emails and names are not. PostHog's free tier covers ~1M events/month which is more than enough for launch.

- **The retention curve is the single most important metric for Phase 2.** Week 2 retention specifically: of users who signed up two weeks ago, how many opened Ledger in the last 7 days? This number determines whether the product works.

### Layer 4: Audit Logging

- **A separate `AuditLog` table exists in the database from migration #1.** Append-only — never updated, never deleted. Storing audit data in the same store as the data it audits is intentional: if the database is restored from backup, the audit log goes with it.

- **Every sensitive action writes an audit log entry.** Token decryption, post deletion by moderation, user data export, account deletion, role changes (when they exist), bulk actions.

- **An `audit.log()` helper exists and is impossible to forget.** Every code path that does something sensitive calls this. Code review specifically checks for missing audit calls.

- **Audit logs are retained for at least 7 years** (longer than typical because educational records carry long retention requirements).

### Cross-Layer: AI-Queryable Logs

- **An AI agent (Claude or otherwise) can query all four layers via a unified interface.** This becomes important once Ledger is live at multiple schools — daily reviews like "any errors yesterday?", "any unusual activity?", "feature usage anomalies?" are exactly what an AI is good at.

- **This is built in Phase 0** as a single function/tool that hits all four sources (Pino logs, Sentry, PostHog, audit log table). Wired into the agentic dev workflow.

---

## Security Baseline

These are non-negotiable from line one of v2:

- **Every API route has rate limiting by default.** Per-user limits enforced server-side. The pattern is set up so that adding rate limiting is the path of least resistance — it should be easier to write a rate-limited route than an unlimited one.

- **Every API route validates input with Zod (or equivalent).** No untrusted data reaches business logic. The pattern is set up so validation is the path of least resistance — writing an unvalidated route is harder than writing a validated one.

- **Authorization is checked on every protected route.** Not just authentication ("are you logged in?") but authorization ("are you allowed to do this thing to this resource?"). A user can only access their own data and the data their enrollments grant them.

- **Strict HTTP security headers ship by default.** Content Security Policy, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy. These are configured in the application's HTTP layer from Phase 0, not added later when something forces them.

- **The FERPA delete path exists from Phase 0.** A `deleteUserCompletely(userId)` function that cascades through all the user's data (posts, study guides, enrollments, tokens, audit logs — with the audit log handled carefully) and a corresponding API endpoint that requires double confirmation. A parent or student asking for deletion on day 2 is not hypothetical.

- **An `Account Settings → Delete My Account` UI exists by launch.** Not on day one, but it's wired in before any real student signs up.

- **The audit log is the answer to "who accessed what."** When (not if) a parent, district, or regulator asks who accessed their child's data, the audit log has the answer in minutes.

---

## Testing and Continuous Integration

- **A test framework is set up from Phase 0.** Vitest is the right choice for the Next.js stack. Test files live alongside the code they test (or in a parallel `tests/` directory — consistent across the codebase).

- **Security-critical modules are tested before they ship.** Encryption (round-trip, GCM tag tampering detection, malformed input rejection), authentication callbacks (session creation, expiry, revocation), and the Canvas sync pipeline (mocked Canvas, real test database, transaction rollback on failure) all have tests.

- **CI runs lint, typecheck, and tests on every push.** Failing CI blocks merging. Set up via GitHub Actions or equivalent. CI configuration lives in the repository.

- **A pre-commit hook (optional) catches obvious mistakes before they reach CI.** Lint and typecheck only — tests are too slow for pre-commit. Use Husky or equivalent if it doesn't add too much friction.

- **Tests are not a "nice to have" added in Phase 3.** They ship with Phase 0 because v2's whole point is that the foundation is right. A foundation without tests is unverified.

---

## Operational Requirements

- **Anthropic API cost monitoring is wired up before AI features ship.** Daily spend tracking, alerts at thresholds, hard ceiling per environment. Finals week with 1,000 students all generating study guides cannot bankrupt Ledger.

- **Uptime monitoring exists from launch.** Better Stack or equivalent — pings every minute, alerts if Ledger is down. Free tier is fine.

- **Backups are configured.** Supabase free tier doesn't include automated backups, so we either upgrade to a paid tier before launch or set up our own pg_dump cron. Either way, before any real student touches the app, backups exist.

- **Environment variables are documented in `.env.example`.** Every variable read by code appears in `.env.example` with a comment explaining what it is and how to get it. A new developer (or fresh agent session) can set up a working local environment from `.env.example` alone.

- **There is a single source of truth for project status.** A README or a `docs/STATUS.md` that says what's working, what's broken, and what's in progress. Updated as a habit, not as a sprint.

---

## Definition of "Foundation Done"

Phase 0 is complete when all of the following are true:

1. A new user can sign up via email magic link, land on an onboarding page, connect their Canvas account (initially via token-paste, eventually via OAuth), and land on a dashboard with their real Canvas data — all running in production, no hardcoded user IDs, no shortcuts.

2. The authentication session works end-to-end on both localhost and Vercel production.

3. All Canvas tokens are encrypted at rest with AES-256-GCM. Token decryption is audited.

4. Supabase Row Level Security policies exist on every table.

5. Every API route is protected by default — auth check, rate limit, and Zod input validation are wrappers that make adding a new endpoint a 30-line operation, not 300.

6. Sentry catches errors in both server and client code, with source maps and user context.

7. Pino (or equivalent) logs every meaningful server-side event in a structured format, with logs shipped to a queryable aggregator in production.

8. PostHog (or equivalent) tracks user behavior with a documented event taxonomy.

9. The `AuditLog` table exists and is written from every sensitive code path.

10. Vitest runs in CI. Tests exist for encryption, sync, and auth callbacks.

11. CI runs lint, typecheck, and tests on every push. Failing CI blocks merging.

12. `.env.example` documents every environment variable.

13. Database migrations are managed via Prisma migrate, committed to the repository, and runnable from terminal. No SQL pasting into Supabase.

14. A `deleteUserCompletely()` function exists and is tested.

15. The plug-and-play feature architecture is set up — `canvas-sync` and `dashboard` are the first two features and they live in feature folders that follow the conventions documented for all future features.

When all 15 are true, Phase 0 is done and feature development begins.

---

## Anti-Patterns (Things v2 Will Not Do)

The lessons from v1, written down so they don't repeat:

- **No dev tokens in `.env` after Phase 0.** Once OAuth works, the dev token is removed. The pattern of "I'll just hardcode my token to test" is forbidden.

- **No SQL editor migrations.** Ever. If it can't go through Prisma migrate, we figure out why and fix it.

- **No hardcoded user IDs.** Not in the dashboard, not in seed scripts, not in tests. Tests create users; they don't reference them by literal string.

- **No hardcoded school IDs.** Multi-school is a foundational requirement, not a Phase 5 feature.

- **No "we'll add tests later."** Security-critical modules ship with tests or they don't ship.

- **No "we'll add logging later."** Instrumentation is foundational. Adding it retroactively means losing the data from before it existed.

- **No admin / faculty / parent features.** Ever. This is a product principle, not a roadmap item. Pressure will come — schools asking for access, parents asking for monitoring. The answer is firm, polite, and permanent: Ledger is for students.

- **No district licensing.** Same reason. The business model is consumer subscription. Anyone proposing district licensing is proposing a different company.

- **No commits to the main branch without CI passing.** This is enforced by branch protection, not by trust.

- **No production deploys without Sentry, logging, and analytics already in place.** The moment a real student touches Ledger, we need to be able to see what happened.

---

## What This Document Is Not

- **It is not a code spec.** It says "we want AES-256-GCM" but not "here's the JavaScript implementation." Implementation details are decided by the agents that build v2.

- **It is not a roadmap.** Feature priorities and timeline are in `ROADMAP.md`. This document is the architectural floor that the roadmap stands on.

- **It is not negotiable in Phase 0.** Once Phase 0 is done and features start shipping, some of these requirements will get refined or extended. But during Phase 0, this is the bar.

- **It is not finished.** This document will evolve as v2 is built. When it changes, the change is documented and the team (currently: one founder + AI agents) re-reads the new version.

---

## How to Use This Document

When an agent is asked to build something for v2:

1. The agent reads this document first.
2. The agent reads `ROADMAP.md` for feature priorities.
3. The agent reads the v1 reference docs (`v1-prototype/ARCHITECTURE.md`, `v1-prototype/ISSUES.md`) for context.
4. The agent proposes a plan that respects every requirement here.
5. The founder reviews the plan.
6. The agent implements.

When a foundation principle is in tension with a feature requirement, the foundation wins. The point of doing this right is that we don't have to do it again.
