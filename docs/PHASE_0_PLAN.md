# Ledger v2 — Phase 0 Implementation Plan

*The foundation, written down. No code in this document — but every line of code that gets written from here on should trace back to something here.*

*Author: lead engineer (agent). Reviewer: Sam Berry. Date drafted: 2026-05-26.*

---

## 0. Preflight: missing reference documents

The kickoff brief asked me to read four documents in order. Only one exists in the repo:

| Document | Status |
| --- | --- |
| `docs/FOUNDATION.md` | ✅ Present and internalized |
| `docs/v1-prototype/ARCHITECTURE.md` | ❌ Missing (directory does not exist) |
| `docs/v1-prototype/ISSUES.md` | ❌ Missing |
| `docs/v1-prototype/ROADMAP.md` | ❌ Missing |

The commit message for `312d927` is "foundation spec and v1 prototype reference," so these were probably meant to be committed alongside FOUNDATION.md and got dropped.

**Impact on this plan.** FOUNDATION.md is thorough enough that I can write a Phase 0 plan without the v1 docs — the Anti-Patterns section already encodes the lessons that ISSUES.md would. But three things suffer:

1. I'm guessing at v1's exact schema and Canvas client code, so when v2 code goes to write, I can't reuse anything from v1 verbatim — every module is a from-scratch design.
2. ROADMAP.md would tell me which features are next so the schema's polymorphic Post table could be designed to fit. I've designed it generically; expect a follow-up tweak when ROADMAP.md lands.
3. The kickoff mentions specific v1 pain points (Next.js 16 issues, Prisma v7 issues, half-working magic-link auth) — I'm taking those at face value and recommending older, more stable versions accordingly.

**Action requested:** add the three missing v1 docs before I start coding. If you don't have them in a usable form, that's fine — say so and I'll proceed with what's in FOUNDATION.md plus this plan.

---

## 1. Decisions Needed Before Coding

Surface-level decisions are below. Each has my recommendation and the reasoning. Approve, reject, or change each one and we move.

### 1.1 Framework versions (the v1 traps)

| Decision | Recommendation | Reasoning |
| --- | --- | --- |
| **Next.js version** | **15.x LTS** (latest 15 minor) | Your kickoff explicitly flags Next 16 as bleeding-edge with v1 issues. 15 is the current LTS line — App Router stable, Server Actions stable, middleware stable, Vercel-first-class. We can upgrade to 16 in Phase 2 once it settles. |
| **Prisma version** | **5.x LTS** (latest 5 minor) | Your kickoff flags Prisma v7 issues. Prisma 5 is the most-deployed Prisma in production today; the NextAuth Prisma adapter, Supabase pooler config, and all docs assume 5.x. v6/v7 introduced breaking changes around `previewFeatures` and connection handling that are still settling. |
| **Auth library** | **NextAuth v4** | Auth.js v5 (the rebrand) is stable but the Resend provider, middleware edge runtime story, and Prisma adapter compatibility were rough into early 2026. NextAuth v4 + Resend + Prisma 5 is the most boring, most-documented combination. We swap to Auth.js v5 in a later phase only when there's a feature we actually need. |
| **Package manager** | **pnpm** | Faster, deterministic, monorepo-ready if we ever split. Vercel supports it natively. |
| **TypeScript** | **strict, no JS** | Non-negotiable for a foundation-first repo. |
| **Styling** | **Tailwind v4 + shadcn/ui pattern** | Tailwind v4 (stable since 2024) is fast and Vercel-tuned. shadcn/ui isn't a dep — it's a copy-paste component pattern that keeps us in control. |

### 1.2 The Canvas-connection contradiction in FOUNDATION.md

FOUNDATION.md contradicts itself on Canvas onboarding:

- **§ Authentication & Sessions** says: *"No token-paste flow in v2."*
- **§ Definition of "Foundation Done" #1** says: *"connect their Canvas account (initially via token-paste, eventually via OAuth)."*

These can't both be true. The resolution affects what Phase 0 ships.

**My read:** the Authentication section is the principle ("no token-paste for real users"); the Done #1 line is operational reality ("we don't have OAuth approved yet"). The way to honor both is:

> **Phase 0 ships token-paste behind an `INVITE_ONLY=true` env flag and a server-side allowlist of <10 emails (you + invited testers). Real signups see a "Canvas integration coming soon" screen, not a paste box. When OAuth lands, both branches converge and the paste path is deleted entirely.**

**Decision needed:** approve that resolution, or pick one of:
- (a) Wait for Canvas OAuth approval before any Phase 0 launch — pushes the date.
- (b) Ship token-paste to everyone behind a click-through warning — violates the no-token-paste principle.
- (c) Hand-provision tokens in the DB for invited testers via a script — keeps the principle absolutely clean, but the manual step doesn't scale past ~20 people.

My recommendation is the framed version above (token-paste behind invite-only allowlist), with (c) as the second-best option.

### 1.3 The Prisma + Supabase RLS architecture question

This is the most important architectural decision in Phase 0 and the easiest to get wrong.

**The problem.** FOUNDATION.md mandates RLS on every table from migration #1. RLS works by inspecting the current Postgres session's claims (typically a JWT). But if we use Prisma to query the database via a single superuser-equivalent connection, Prisma's queries **bypass RLS entirely** — RLS becomes decoration, not defense.

**The three viable patterns:**

| Pattern | How it works | Trade-off |
| --- | --- | --- |
| **A. Prisma-only, RLS as belt-and-suspenders** | All app queries go through Prisma using a non-superuser role (`app_user`). Before each query, we `SET LOCAL request.jwt.claims = '...'` so RLS policies can read the current user/school. | Most code-uniform. Requires a Prisma extension or transaction wrapper to set the claim per request. Standard but non-trivial. **My recommendation.** |
| **B. Supabase JS client for reads, Prisma for migrations + writes** | User-scoped reads use `@supabase/supabase-js` (which carries the JWT natively, RLS works automatically). Mutations and migrations use Prisma. | RLS works "for free" on reads. Two query interfaces in the codebase = more surface area, harder to keep consistent. |
| **C. Prisma-only, RLS off in app code** | RLS is enabled but Prisma bypasses it. App-layer auth-check is the only safety net. | Violates FOUNDATION.md "RLS is defense-in-depth." Not acceptable. |

**Decision needed:** approve Pattern A, or override.

If A: I'll write a `prismaWithSession()` factory that opens a transaction, sets the JWT claims, runs the query, commits. Every server action calls this. The pattern is ~30 lines and well-documented in Supabase's Prisma guide.

### 1.4 Multi-school onboarding mechanism

FOUNDATION.md mandates multi-school from line one, but doesn't say *how* a user's school is determined at signup.

**Options:**

1. **Email-domain mapping.** `samuel@drippingsprings.k12.tx.us` → school = Dripping Springs. Pre-seed a `School` table with domain patterns.
2. **User picks from dropdown** at onboarding.
3. **Derived from Canvas** after they connect.

Real students often use personal Gmail addresses, so (1) alone fails. (3) requires Canvas to be connected before we know what school the user is from, which is too late for any school-scoped UI. (2) is robust but boring.

**Recommendation: (1) + (2) fallback.** Try domain match first; if no match, show the dropdown. Pre-seed Dripping Springs High School with both `@drippingsprings.k12.tx.us` and the public Gmail-using student case (dropdown). When Canvas connects later, we verify the Canvas school matches the chosen one and flag mismatches in the audit log.

**Decision needed:** approve this approach, or specify.

### 1.5 Feature flag provider

FOUNDATION.md requires per-environment, per-school, per-user flags. Two real choices:

- **PostHog feature flags.** Free, already a required dep, supports all three scopes, has SDK + UI.
- **Homegrown `FeatureFlag` table + admin UI.** More work, fully under our control, no external dep.

**Recommendation: PostHog flags.** Saves us building (and maintaining) an admin UI. If PostHog flags don't fit a future use case, we add the homegrown table then.

### 1.6 Other smaller decisions

| Decision | Recommendation |
| --- | --- |
| **Hosting** | Vercel (already implied by FOUNDATION's HTTPS note). Confirm. |
| **Log aggregator** | Better Stack (you have credentials saved). Confirm. |
| **Backups** | Upgrade Supabase to Pro ($25/mo) for PITR before launch. Cheaper-than-our-time vs rolling our own pg_dump cron. Confirm. |
| **Pre-commit hook** | Husky + lint-staged: runs eslint + tsc on changed files only. Tests don't run pre-commit (too slow). |
| **Audit log immutability** | Postgres RLS policy that denies UPDATE/DELETE for everyone except a `superuser` role nobody has in production. Append-only via insertion permission for `app_user`. |
| **CI provider** | GitHub Actions. Free for public/light-use private repos. |
| **Branch protection on `main`** | Required: all CI checks green, ≥1 approving review (or self-review for solo period), no direct pushes, signed commits not required (low value for solo dev). |
| **Node version** | Pin to Node 22 LTS in `.nvmrc`, `package.json` engines, and CI. |
| **Repo monorepo or single app?** | Single Next app for Phase 0. Monorepo later if/when a mobile app or shared package emerges. |

---

## 2. Phase 0 Scope: All 15 "Done" Criteria, in Build Order

Every one of FOUNDATION.md's 15 done criteria is in Phase 0 scope — that's what "foundation done" means. The question is the order. Each milestone below maps to specific done-criteria IDs (DC1–DC15).

**Build order (top-to-bottom dependency chain):**

| Milestone | What it ships | Done criteria covered |
| --- | --- | --- |
| **A. Repo & tooling** | Next 15, TS strict, Tailwind, ESLint, Prettier, pnpm, Vitest config, Husky, `.env.example` skeleton | DC12 (env doc), preconditions for everything |
| **B. Database foundation** | Supabase project, Prisma schema, first migration, RLS migration, seed script with `isTestData`, `db:reset` | DC4 (RLS), DC13 (Prisma migrations) |
| **C. Observability (built before features so we see what we build)** | Pino logger, Sentry init server+client+sourcemaps, PostHog init, AuditLog table + helper, AI-queryable logs interface | DC6 (Sentry), DC7 (Pino), DC8 (PostHog), DC9 (AuditLog) |
| **D. Security primitives** | AES-256-GCM `encrypt`/`decrypt` module, `withApi` wrapper (auth + rate limit + Zod), Upstash Redis client, HTTP security headers | DC3 (encryption), DC5 (API protection) |
| **E. Authentication** | NextAuth v4 with Resend magic-link, Prisma adapter, Postgres-backed sessions, middleware default-deny, login + onboarding pages | DC1 (signup-to-dashboard, partial), DC2 (auth on local + prod) |
| **F. Canvas sync (invite-only token-paste)** | Canvas client, `CanvasToken` table with encryption at insert, `canvas.sync` server action, full sync to courses + assignments | DC1 (Canvas connect, partial), DC3 (decryption audited) |
| **G. Dashboard feature (the plug-and-play showcase)** | `src/features/dashboard/` and `src/features/canvas-sync/` as the first two feature folders, both following the conventions every future feature will follow | DC1 (dashboard renders real data), DC15 (plug-and-play proven) |
| **H. FERPA delete path** | `deleteUserCompletely(userId)` function, double-confirm API endpoint, Settings → Delete Account UI | DC14 |
| **I. Testing & CI** | Vitest tests for encryption, sync, auth callbacks; GitHub Actions: lint + typecheck + test + migrate-diff; branch protection on main | DC10 (Vitest in CI), DC11 (CI gates) |
| **J. Production cutover** | Vercel deploy, all env vars in Vercel, Supabase Pro upgrade, Better Stack uptime monitor, end-to-end smoke test in prod | DC1 (running in production), DC2 (Vercel session) |

**Critical dependencies:**

- **B before C:** AuditLog table must exist before the audit helper can write to it.
- **B before E:** NextAuth's Prisma adapter requires `Account`, `Session`, `VerificationToken` tables to exist in the migration before NextAuth boots.
- **C before D:** the audit helper must work before the encryption module logs decryptions.
- **D before E:** `withApi` is the wrapper NextAuth's custom routes will use.
- **E before F:** Canvas sync reads `session.user.id` to know whose token to use.
- **F before G:** the dashboard renders data the sync writes.
- **All of A–H before I:** can't write CI for code that doesn't exist.
- **I before J:** never deploy without green CI.

**Wrong-order temptations to resist:**

- Don't build the dashboard before observability. We'll lose the data we need to know if it works.
- Don't ship auth before encryption + audit. The first thing auth touches (Canvas tokens) is the most sensitive data we have.
- Don't deploy to Vercel until CI is green on `main`. Vercel will deploy broken main otherwise.

---

## 3. Deliverables by Milestone

This is the concrete file-by-file list. Paths assume the conventional Next 15 App Router layout (`src/app/...`).

### Milestone A — Repo & tooling

| Deliverable | Path | Purpose |
| --- | --- | --- |
| Next.js 15 init | `package.json`, `next.config.ts`, `tsconfig.json`, `src/app/layout.tsx`, `src/app/page.tsx` (placeholder) | Boot the app |
| Tailwind v4 | `postcss.config.mjs`, `src/app/globals.css` | Styling |
| ESLint | `eslint.config.mjs` | Lint config (Next preset + custom rules) |
| Prettier | `.prettierrc.json`, `.prettierignore` | Format |
| pnpm | `pnpm-lock.yaml`, `.npmrc` (set `engine-strict=true`) | Package manager |
| Node version pin | `.nvmrc` (`22`), `package.json` `engines.node` | Reproducibility |
| Vitest | `vitest.config.ts`, `src/test/setup.ts` | Test framework |
| Husky + lint-staged | `.husky/pre-commit`, `package.json` `lint-staged` block | Pre-commit lint/typecheck |
| `.env.example` | `/.env.example` | Documented env vars (full list in §4) |
| `.gitignore` | `/.gitignore` | Standard Next + env + Prisma + Sentry |
| `README.md` (rewrite from empty) | `/README.md` | Quickstart + STATUS pointer |
| `docs/STATUS.md` | `/docs/STATUS.md` | Living "what's working / what's broken" — FOUNDATION § Operational |

### Milestone B — Database foundation

| Deliverable | Path | Purpose |
| --- | --- | --- |
| Prisma init | `prisma/schema.prisma` | Schema source of truth |
| Initial migration | `prisma/migrations/<ts>_init/migration.sql` | Tables: `User`, `Account`, `Session`, `VerificationToken` (NextAuth), `School`, `Enrollment`, `AuditLog`, `CanvasToken`, `Course`, `Assignment`, `Post` (skeleton), `Reaction` (skeleton) |
| RLS migration | `prisma/migrations/<ts>_rls/migration.sql` | RLS enabled on every table, policies per table, `app_user` Postgres role created, audit-log INSERT-only |
| Seed script | `prisma/seed.ts` | Inserts Dripping Springs school, test users with `isTestData=true`, dev-only sample courses/assignments |
| DB reset script | `package.json` script `db:reset` → `prisma migrate reset --force && pnpm tsx prisma/seed.ts` | One-command local rebuild |
| Schema design doc | `docs/db/SCHEMA.md` | ERD + rationale for polymorphic `Post`, cascade behavior, index choices |
| Prisma client singleton | `src/lib/db/prisma.ts` | Avoids dev-mode connection leaks |
| Session-aware DB wrapper | `src/lib/db/withSession.ts` | Opens transaction, `SET LOCAL request.jwt.claims`, runs callback (implements Decision 1.3 Pattern A) |

**Schema notes (the non-obvious bits):**

- `User.schoolId` — FK to `School`. Set at signup, immutable thereafter.
- `Enrollment` — `(userId, courseId, role)`. Role is always `student` in v2; column exists to make RLS policies symmetric with a later "TA" feature if it ever ships.
- `CanvasToken.ciphertext` — bytea or text base64 of `IV ‖ tag ‖ encrypted`. Never queryable; only read via the `getDecryptedToken(userId)` helper, which audits.
- `Post` — polymorphic via `(targetType, targetId)` for "post on course X" / "post in school Hype Feed" / "post is comment on post Y." Schema design doc explains the choice.
- `AuditLog` — `(id, actorUserId, schoolId, action, targetType, targetId, metadata jsonb, createdAt)`. RLS denies UPDATE/DELETE for `app_user`.

### Milestone C — Observability

| Deliverable | Path | Purpose |
| --- | --- | --- |
| Pino logger | `src/lib/log/logger.ts` | Structured logger, pretty-printed in dev, Better Stack transport in prod |
| Sentry server init | `instrumentation.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` | Catch server + edge errors |
| Sentry client init | `sentry.client.config.ts` | Catch browser errors |
| Sentry build plugin | `next.config.ts` (`withSentryConfig`) | Source map upload |
| PostHog client init | `src/lib/analytics/posthog.client.ts` | Browser events |
| PostHog server init | `src/lib/analytics/posthog.server.ts` | Server-side events |
| Event taxonomy doc | `docs/observability/EVENTS.md` | Canonical event names — `<domain>.<action>.<outcome>` |
| Audit helper | `src/lib/audit/audit.ts` (`audit.log({ action, actorUserId, targetType, targetId, metadata })`) | Single point of audit truth |
| AI-queryable logs interface | `src/lib/log/query.ts` (`queryAll({ source: 'pino' \| 'sentry' \| 'posthog' \| 'audit', filter, range })`) | One function hits all four layers — FOUNDATION § Cross-Layer |
| Tests | `src/lib/audit/audit.test.ts`, `src/lib/log/logger.test.ts` | Audit writes the right row; sensitive fields are redacted |

### Milestone D — Security primitives

| Deliverable | Path | Purpose |
| --- | --- | --- |
| Encryption module | `src/lib/crypto/encryption.ts` (`encrypt(plaintext)`, `decrypt(ciphertext, { reason, actorUserId })`) | AES-256-GCM. `decrypt` always audits. |
| Encryption tests | `src/lib/crypto/encryption.test.ts` | Round-trip, GCM tag tampering fails, malformed input rejected, IV uniqueness across N calls |
| Upstash Redis client | `src/lib/rate-limit/redis.ts` | Connection to Upstash |
| Rate limiter | `src/lib/rate-limit/limiter.ts` (`limit(key, { limit, window })`) | Sliding-window via `@upstash/ratelimit` |
| API wrapper | `src/lib/api/withApi.ts` (`withApi({ schema, rateLimit, public? }, handler)`) | One wrapper does auth + rate limit + Zod parse. Writing an unwrapped route is harder than wrapping it (FOUNDATION § Security Baseline). |
| Wrapper tests | `src/lib/api/withApi.test.ts` | Unauth → 401, rate-limited → 429, bad input → 400, success path |
| HTTP security headers | `next.config.ts` `headers()` | CSP, HSTS, X-Frame-Options DENY, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy minimal |

### Milestone E — Authentication

| Deliverable | Path | Purpose |
| --- | --- | --- |
| NextAuth config | `src/lib/auth/config.ts` | Resend provider, Prisma adapter, session strategy = `database`, callbacks set school context, audit log on signin/signout |
| NextAuth route handler | `src/app/api/auth/[...nextauth]/route.ts` | Standard handler |
| Middleware | `src/middleware.ts` | Default-deny; explicit public allowlist for `/`, `/login`, `/api/auth/*`, `/api/health` |
| Auth helpers | `src/lib/auth/session.ts` (`getServerSession()`, `requireUser()`) | Centralized session reads |
| Login page | `src/app/login/page.tsx` | Email input → magic link sent |
| Magic link sent page | `src/app/login/check-email/page.tsx` | "Check your inbox" UI |
| Onboarding page | `src/app/onboarding/page.tsx` | School pick (domain match preview + dropdown fallback), name, grad year |
| Onboarding action | `src/app/onboarding/actions.ts` | Server action: persists School + grad year, audits |
| Auth callbacks tests | `src/lib/auth/callbacks.test.ts` | Session creation writes audit log; expired session is rejected; revoked session is rejected |

### Milestone F — Canvas integration (invite-only token-paste)

| Deliverable | Path | Purpose |
| --- | --- | --- |
| Canvas client | `src/features/canvas-sync/client.ts` | Typed wrapper over Canvas REST API; rate-limit-aware; retries on 429 |
| Token paste UI | `src/features/canvas-sync/components/ConnectCanvas.tsx` | Only shown if `INVITE_ONLY=true` and current user email is in the allowlist |
| Token storage action | `src/features/canvas-sync/actions/saveToken.ts` | Encrypts then stores `CanvasToken`; audits |
| Sync action | `src/features/canvas-sync/actions/sync.ts` | Decrypts (audits), calls Canvas, writes courses + assignments in a transaction. On any error, transaction rolls back, error to Sentry, event to Pino, `lastSyncedAt` not bumped. |
| Sync tests | `src/features/canvas-sync/sync.test.ts` | Mocked Canvas + real test DB. Asserts: full success bumps `lastSyncedAt`; partial failure rolls back the entire transaction; decrypt audit row is written every call. |
| Canvas event taxonomy entries | `docs/observability/EVENTS.md` (additions: `canvas.sync.started`, `canvas.sync.succeeded`, `canvas.sync.failed`, `canvas.token.decrypted`, `canvas.token.encrypted`) | Catalog the events this feature emits |
| Invite allowlist | `src/lib/auth/inviteAllowlist.ts` (reads from env or DB) | Source of "who can paste a token" |

### Milestone G — Dashboard feature

| Deliverable | Path | Purpose |
| --- | --- | --- |
| Dashboard page | `src/features/dashboard/page.tsx` | Server component; `requireUser()`; renders courses + upcoming assignments |
| Dashboard queries | `src/features/dashboard/queries.ts` | All queries take `userId` from session — never a literal |
| Dashboard tests | `src/features/dashboard/queries.test.ts` | Queries return only the calling user's data even if a peer's `userId` is forged (RLS proof) |
| Feature folder convention doc | `docs/architecture/FEATURE_FOLDERS.md` | The template every future feature follows: `page.tsx`, `actions/*`, `queries.ts`, `components/*`, `*.test.ts` |

### Milestone H — FERPA delete path

| Deliverable | Path | Purpose |
| --- | --- | --- |
| Delete function | `src/lib/user/deleteUserCompletely.ts` | Single transaction. Cascade: tokens, enrollments, posts, study guides, sessions, accounts. AuditLog rows about the user are **retained** (the audit log survives the user) but the `actorUserId` is replaced with `<deleted-user-XXXX>` to break PII linkage while keeping the audit trail. |
| Delete API endpoint | `src/app/api/account/delete/route.ts` | Requires double confirmation (current session + a fresh token from a confirmation email) |
| Delete UI | `src/app/settings/account/page.tsx` (Delete Account section) | Behind a confirmation modal |
| Delete tests | `src/lib/user/deleteUserCompletely.test.ts` | Cascade works for every related table; audit log is preserved per policy above; idempotent on retry |

### Milestone I — Testing & CI

| Deliverable | Path | Purpose |
| --- | --- | --- |
| GitHub Actions workflow | `.github/workflows/ci.yml` | Jobs: install → lint → typecheck → prisma-migrate-diff → test. Concurrency: cancel stale runs. |
| Test DB strategy | `vitest.config.ts` + `src/test/setup.ts` | Spin a separate Supabase test schema (or use `pg-mem` for unit, real Postgres in a service container for integration). Decision in §5. |
| Coverage threshold | `vitest.config.ts` | Initial floor: 80% on `src/lib/`, 70% on `src/features/`. Not gated in CI in Phase 0; reported. |
| Branch protection | (manual on GitHub) | Require all CI jobs green; require linear history; no force-push to main. |
| CODEOWNERS | `.github/CODEOWNERS` | All paths → `@samberry`. Updated when the team grows. |

### Milestone J — Production cutover

| Deliverable | Where | Purpose |
| --- | --- | --- |
| Vercel project | (Vercel dashboard) | Linked to GitHub repo, auto-deploy `main` to prod, preview deploys on PR |
| Env vars in Vercel | Vercel UI | Every var from §4, scoped to Production / Preview / Development as appropriate |
| Supabase Pro upgrade | Supabase dashboard | PITR backups |
| Better Stack uptime monitor | Better Stack UI | 1-minute ping on `/api/health`; alert to your email |
| `/api/health` endpoint | `src/app/api/health/route.ts` | Returns 200 + checks DB connection + Redis connection |
| Anthropic cost monitor placeholder | `src/lib/ai/budget.ts` | Stub returning `{ used: 0, limit: env.AI_BUDGET_USD }`. Filled in when AI features land in Phase 1+. Wired so future code can call `assertBudget()` before hitting Claude. |
| Production smoke test runbook | `docs/runbooks/SMOKE_TEST.md` | Manual checklist matching FOUNDATION done criteria #1 in production |

---

## 4. Environment Variables

Every variable Phase 0 will read. The `.env.example` will mirror this with comments.

### Required for all environments

| Var | Used for | How to get |
| --- | --- | --- |
| `DATABASE_URL` | Prisma connection (Supabase pooler, `?pgbouncer=true&connection_limit=1`) | Supabase project settings → Database → Connection string → "Transaction" mode |
| `DIRECT_URL` | Prisma migrations (direct connection, no pooler) | Same screen → "Session" mode |
| `NEXTAUTH_SECRET` | NextAuth session encryption | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | NextAuth callback base URL | `http://localhost:3000` dev / `https://ledger.app` prod |
| `ENCRYPTION_KEY` | AES-256-GCM key for Canvas tokens | `openssl rand -hex 32` (must be 64 hex chars = 32 bytes) |
| `RESEND_API_KEY` | Magic-link email sender | Resend dashboard → API Keys (you have this) |
| `RESEND_FROM_EMAIL` | The `From:` on magic-link emails | `login@ledger.app` (requires verified domain in Resend) |
| `UPSTASH_REDIS_REST_URL` | Rate-limit store | Upstash console (you have this) |
| `UPSTASH_REDIS_REST_TOKEN` | Rate-limit auth | Upstash console (you have this) |
| `SENTRY_DSN` | Server-side error reporting | Sentry → project settings → Client Keys (you have this) |
| `NEXT_PUBLIC_SENTRY_DSN` | Client-side error reporting | Same as above (yes, same value; just exposed) |
| `SENTRY_ORG` | Source map upload | Sentry org slug |
| `SENTRY_PROJECT` | Source map upload | Sentry project slug |
| `SENTRY_AUTH_TOKEN` | Source map upload (build only) | Sentry → Settings → Auth Tokens → "project:write" scope |
| `NEXT_PUBLIC_POSTHOG_KEY` | Client analytics | PostHog → Project → API Keys (you have this) |
| `NEXT_PUBLIC_POSTHOG_HOST` | Client analytics | `https://us.i.posthog.com` (or EU) |
| `POSTHOG_PROJECT_API_KEY` | Server-side analytics | Same key, exposed for server use |
| `BETTER_STACK_SOURCE_TOKEN` | Pino → Better Stack transport | Better Stack → Sources → your source (you have this) |
| `INVITE_ONLY` | Feature flag: gates Canvas token paste to allowlist | `true` in prod until OAuth lands, `false` after |
| `INVITE_ALLOWLIST` | Comma-separated emails allowed to paste Canvas tokens | Your email + invited testers |
| `NODE_ENV` | Standard | Auto-set by Vercel/Next |

### Conditionally required

| Var | When needed |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Only if we use the Supabase JS admin client for any one-off ops (probably not in Phase 0). If unused, omit. |
| `NEXT_PUBLIC_SUPABASE_URL` | Only if we adopt Decision 1.3 Pattern B (mixed Prisma + Supabase JS). If we go Pattern A, omit. |
| `CANVAS_OAUTH_CLIENT_ID`, `CANVAS_OAUTH_CLIENT_SECRET` | When OAuth approval comes through; placeholders in `.env.example` for now. |
| `AI_BUDGET_USD_DAILY` | Set when AI features ship (Phase 1+); placeholder in Phase 0 budget stub. |

### Vercel-specific

| Var | Used for |
| --- | --- |
| `VERCEL_URL` | Auto-set by Vercel; useful for preview deploys' NextAuth callback URLs |
| `VERCEL_ENV` | Auto-set; `production` / `preview` / `development` |

---

## 5. Testing Strategy

The principle from FOUNDATION.md: **tests ship with Phase 0**. Not all tests — security-critical ones. The rest grow with features.

### Test pyramid for Phase 0

| Layer | Tool | What gets tested |
| --- | --- | --- |
| **Unit** (fast, no DB) | Vitest + `vi.mock` | Pure functions: encryption, validators, formatters, audit helper (DB mocked), rate limiter logic |
| **Integration** (real Postgres) | Vitest + Docker Postgres OR Supabase branch DB | Prisma queries, RLS policies, auth callbacks, full Canvas sync against mocked Canvas + real DB, `deleteUserCompletely` cascade |
| **E2E** (real browser) | **Not in Phase 0.** | Deferred to Phase 2 with Playwright. Manual smoke-test runbook covers Phase 0. |

### Test DB strategy decision

Two options for integration tests:

| Approach | Pros | Cons |
| --- | --- | --- |
| **Local Postgres in Docker** | Hermetic, fast, no Supabase dependency | Need to replicate Supabase's RLS context (`request.jwt.claims`) manually; adds drift risk |
| **Supabase branch databases** (preview branches feature) | Tests run against the real Supabase Postgres, same RLS behavior as prod | Requires Supabase Pro; slower CI; need to clean up branches |

**Recommendation:** local Postgres in Docker for CI. We replicate the `SET LOCAL request.jwt.claims` pattern in a test helper, which is also what production code does — same path. Supabase Pro is for backups, not tests. Decision needed if you disagree.

### Tests required for Phase 0 sign-off

| Module | Test cases (minimum) |
| --- | --- |
| `src/lib/crypto/encryption.ts` | Round-trip; tag tampering rejected; IV uniqueness across 1000 calls; malformed ciphertext rejected; key length validation |
| `src/lib/audit/audit.ts` | Writes correct row; failure to write is logged + alerted but doesn't block the calling action (or does — decision below); sensitive fields redacted |
| `src/lib/auth/callbacks.ts` | Sign-in writes `auth.session.created` audit; sign-out writes `auth.session.revoked`; expired session is rejected by middleware |
| `src/lib/api/withApi.ts` | Unauthed → 401 + audit; rate-limited → 429; bad input → 400; success path passes parsed body to handler |
| `src/features/canvas-sync/sync.ts` | Full sync succeeds; partial failure rolls back the entire transaction (no half-synced state); every decryption writes an audit row |
| `src/features/dashboard/queries.ts` | Returns only `session.user.id`'s data; forging a different `userId` in code path fails (RLS catches it) |
| `src/lib/user/deleteUserCompletely.ts` | Cascade hits every related table; audit log retained per policy; idempotent |
| `src/middleware.ts` | Public routes accessible without session; everything else 302s to `/login` |

**Open testing question:** when `audit.log()` itself fails (DB down), do we fail the calling action or fall through? Failing closed means a transient DB issue logs out all users. Failing open means we can miss audit events. Recommendation: fail open + emit a Sentry critical alert. Decision needed.

### CI workflow shape

```
on: [push, pull_request]
jobs:
  install:     pnpm install --frozen-lockfile
  lint:        pnpm lint                        (needs: install)
  typecheck:   pnpm typecheck (tsc --noEmit)    (needs: install)
  migrate-diff: prisma migrate diff (asserts schema and migrations are in sync)  (needs: install)
  test:        pnpm test (vitest run --coverage)
               Postgres service container 16-alpine on port 5432
               (needs: install)
  build:       pnpm build  (catches build-time errors Sentry sourcemap upload would fail on)
               SENTRY_AUTH_TOKEN scoped to this job only
               (needs: install)
```

Concurrency group: `${{ github.ref }}` with `cancel-in-progress: true`.

Branch protection on `main`: lint + typecheck + migrate-diff + test + build all required.

---

## 6. Plug-and-Play Feature Architecture (the contract)

Every feature folder under `src/features/<feature-name>/` follows this template. It's encoded in `docs/architecture/FEATURE_FOLDERS.md`. New features that don't fit it are evidence the foundation is wrong, not that the rules should bend.

```
src/features/<feature-name>/
  page.tsx                  ← optional: the feature's Next route page
  actions/                  ← server actions (form submissions, mutations)
  queries.ts                ← read-only DB queries, session-scoped
  components/               ← UI components specific to this feature
  schema/                   ← Prisma schema fragments — composed into prisma/schema.prisma at build via prisma's preview "schemaFolder" or manual concat
  events.ts                 ← typed event names this feature emits (referenced in EVENTS.md)
  flags.ts                  ← typed feature flag keys this feature reads
  README.md                 ← what this feature does, who owns it, what flag controls it
  *.test.ts                 ← tests
```

**The rules:**

1. A feature **imports from** `src/lib/*` (shared infrastructure: auth, db, log, audit, crypto, rate-limit, api wrapper, analytics).
2. A feature **does not import from** another feature. Cross-feature needs become shared lib modules.
3. A feature's schema additions live in `schema/` and are composed into the root `schema.prisma`. Every migration is generated and committed.
4. A feature's flag determines whether it renders. If the flag is off, the feature's routes 404 and its UI doesn't mount.
5. A feature's events are catalogued in the central `EVENTS.md` taxonomy before they're emitted.

Phase 0 ships **two features** that prove this contract works: `canvas-sync` and `dashboard`. Anything we got wrong about the contract should surface during their build, before any user-facing feature in Phase 1.

---

## 7. Phase 0 Complete: Verification Checklist

Run this top-to-bottom in production (`https://ledger.app` or whatever the prod URL is) before declaring Phase 0 done. Every box must be checked.

### Founder-runnable smoke test

- [ ] **Sign in.** Open prod URL incognito → enter your email → receive magic link email within 30s → click link → land on `/onboarding`.
- [ ] **Onboarding.** Pick Dripping Springs (either by domain match or dropdown) → enter name + grad year → submit → land on `/dashboard`.
- [ ] **Empty dashboard.** Dashboard shows "Connect Canvas to see your courses" CTA (because you're invite-only, the paste UI is shown; for non-allowlisted users, "coming soon" placeholder).
- [ ] **Canvas connect.** Paste your Canvas token → save → see "syncing…" → dashboard repopulates with your real Dripping Springs courses + upcoming assignments.
- [ ] **No hardcoded IDs.** Open the same browser as a different invited tester → they see their data, not yours.
- [ ] **Session works on Vercel.** Refresh the page; still signed in. Close browser, reopen within 30 days; still signed in.
- [ ] **Sign out.** Click sign out → redirected to `/login` → refreshing `/dashboard` redirects to `/login`.

### Infrastructure checks

- [ ] **Sentry.** Trigger a test error (`/api/_test-error` route gated by `NODE_ENV !== 'production'` OR a one-time prod test). Confirm it appears in Sentry with user context, stack trace, and source map mapped to original TS.
- [ ] **Pino → Better Stack.** Within 60s of a magic-link login, see `auth.session.created` event in Better Stack with the user's ID (not email).
- [ ] **PostHog.** Within 60s of dashboard load, see `dashboard.viewed` event in PostHog with `distinct_id = userId`.
- [ ] **Audit log.** Open Supabase SQL editor; `SELECT * FROM "AuditLog" ORDER BY "createdAt" DESC LIMIT 10` — see entries for `auth.session.created`, `canvas.token.encrypted`, `canvas.token.decrypted`.
- [ ] **AI-queryable logs.** From a script, call `queryAll({ source: 'audit', filter: { action: 'canvas.token.decrypted' }, range: 'last-1h' })` — returns the row above.
- [ ] **RLS.** With a non-admin Postgres role, attempt `SELECT * FROM "CanvasToken"` — denied unless `request.jwt.claims.user_id` matches the row.
- [ ] **Rate limit.** Hit `/api/auth/signin` 20 times in 60s from one IP — get 429 on later requests, audited.
- [ ] **Encryption round-trip in production.** A Vercel function calling `encrypt → decrypt` returns the original plaintext (one-time smoke).

### Operational checks

- [ ] **CI green on main.** Last commit's GitHub Actions run shows all jobs green.
- [ ] **Branch protection.** Attempting to push directly to `main` from local is rejected.
- [ ] **Migrations clean.** `pnpm prisma migrate status` against prod DB shows "Database schema is up to date."
- [ ] **`.env.example` complete.** Every var the code reads is documented in `.env.example` with a comment.
- [ ] **Better Stack uptime monitor.** Configured, pinging `/api/health`, last 24h shows 100%.
- [ ] **Supabase Pro.** Backups confirmed in Supabase dashboard.
- [ ] **`docs/STATUS.md` updated.** Reflects "Phase 0 complete" with date and commit SHA.

### Code health checks

- [ ] **No `TODO` comments referencing FOUNDATION.md items.** If anything from FOUNDATION.md is unfinished, it's a Phase 0 gap, not a Phase 1 ticket.
- [ ] **No hardcoded user IDs.** `grep -rn "userId.*=.*\"" src/` returns nothing matching a UUID pattern.
- [ ] **No hardcoded school IDs.** Same grep for school.
- [ ] **No dev tokens in `.env`.** `.env` (yours) and Vercel env do not contain a Canvas `CANVAS_TOKEN=...` var.
- [ ] **No SQL pasted into Supabase editor since project start.** Schema history matches `prisma/migrations/` ordering exactly.
- [ ] **`deleteUserCompletely` round-trips in a test.** Test creates a user, populates all related tables, deletes, asserts cascade.
- [ ] **Two feature folders exist and follow the convention.** `src/features/canvas-sync/` and `src/features/dashboard/` both have `page.tsx` (where applicable), `queries.ts`, `components/`, `*.test.ts`, `README.md`, and import only from `src/lib/`.

When all boxes are checked, Phase 0 is done.

---

## 8. Open Questions and Things I'd Want to Verify Mid-Build

Not blocking decisions — things I'll surface as I encounter them, but worth flagging now so you're not surprised.

1. **Resend's free tier limits.** 100 emails/day, 3000/month. Fine for invite-only Phase 0, may need to upgrade ($20/mo) when real students sign up.
2. **Upstash free tier limits.** 10k requests/day. Rate-limit + a small per-route count is well under, but worth watching.
3. **Sentry free tier limits.** 5k errors/month. Fine unless something is broken; will alert if we approach.
4. **PostHog free tier.** 1M events/month. Way over what Phase 0 needs.
5. **Better Stack free tier.** 1GB logs/month, 10 uptime monitors. Fine.
6. **Multi-region Supabase.** Default region matters for latency for Texas students. Pick `us-east-2` (Ohio) or `us-west-1` — confirm before provisioning.
7. **NextAuth + Supabase pooler.** The Prisma adapter's table creation pre-flight can deadlock on pgBouncer in transaction mode. Solution: NextAuth uses `DIRECT_URL`, app queries use `DATABASE_URL`. I'll wire this correctly but flagging because it's a v1-pattern landmine.
8. **Edge runtime for middleware.** NextAuth's middleware works on the Edge runtime in v4 with the JWT strategy, but we're using `database` session strategy which requires Node. Workaround: middleware does a cheap cookie-presence check + redirect; the actual session validation happens in Node-runtime route handlers via `getServerSession()`. Standard pattern; flagging because it's subtle.
9. **The `prisma generate` step in Vercel build.** Easy to forget; will be in the `build` script.

---

## 9. Risks

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Canvas OAuth approval takes months → Phase 0 stays invite-only longer than expected | High | Invite-only path is designed to live for a while; not a launch blocker for the **friends-test** version of Phase 0 |
| Prisma + RLS pattern (Decision 1.3) turns out to be more fragile than expected | Medium | Fallback to Pattern B (mixed Prisma + Supabase JS); designed so the migration is mechanical |
| Supabase pooler + Prisma + NextAuth integration issues (see Q7) | Medium | Use `DIRECT_URL` for adapter, `DATABASE_URL` for queries; documented pattern |
| Source map upload failures break Sentry usefulness silently | Low | CI job asserts source map upload succeeded; alert if it doesn't |
| Pre-launch real-student volume blows free tiers | Low for Phase 0; high post-launch | Tracked in `docs/STATUS.md`; trigger paid upgrades at thresholds documented there |

---

## 10. What This Plan Does Not Cover

Honest scope statement:

- **No AI/study guide features.** Anthropic budget monitoring stub is wired in Phase 0; actual AI usage is Phase 1+.
- **No social features.** `Post` table exists as a polymorphic skeleton; no Hype Feed, Pulse, comments, or reactions UI in Phase 0.
- **No mobile app.** Web only.
- **No admin tooling.** Per FOUNDATION's "students only forever" principle — there is no admin role. Operational tasks happen via Supabase SQL editor (read-only investigation) or one-off scripts you run locally with `pnpm tsx`.
- **No Playwright E2E.** Manual smoke-test runbook only.
- **No `noUncheckedIndexedAccess` or other extreme TS settings.** Strict mode but not "strict-as-possible." Can ratchet up later.

When Phase 0 is done, all 15 done criteria are met and these scope cuts become the natural starting points for Phase 1 (which will be planned separately after `docs/v1-prototype/ROADMAP.md` materializes).
