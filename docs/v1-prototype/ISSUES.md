# Ledger — Known Issues

_As of 2026-05-24. Companion to [ARCHITECTURE.md](./ARCHITECTURE.md). Sequencing of fixes lives in [ROADMAP.md](./ROADMAP.md)._

This is a brutally honest accounting. Severity uses three buckets:

- **Critical** — would break in production, leak data, or violate FERPA. Must be fixed before any real user touches the app.
- **Important** — would hurt launch quality, scale, or operability. Should land before mid-August soft launch.
- **Minor** — paper cuts, cleanup, code quality. Nice-to-have.

Every issue links to the specific file/line it's grounded in.

---

## Critical

### C1. No authentication at all

**Where:** [src/app/page.tsx:4](../src/app/page.tsx#L4) — `const DEV_USER_ID = 'cmpix1ayn0002pu98c3npnk4b'`

The dashboard is a public route that auto-loads as one hardcoded user. Anyone who visits the site is "logged in" as that user. `next-auth` and `@auth/prisma-adapter` are installed but never imported.

**Fix sketch:** Wire NextAuth with a Canvas OAuth provider, replace `DEV_USER_ID` with the session user, add a `middleware.ts` redirect for unauthenticated requests. Canvas doesn't ship a NextAuth provider out of the box — needs a custom OAuth2 provider config pointing at the school's Canvas `/login/oauth2/auth` and `/login/oauth2/token`.

---

### C2. School-scoped course visibility (FERPA)

**Where:** [src/lib/queries.ts:19-25](../src/lib/queries.ts#L19-L25) — explicit TODO comment + `findMany({ where: { schoolId } })`

`getDashboardData` returns every course at the user's school, not just the ones the user is enrolled in. The author called it out: _"every user at a school sees every course at that school — fine for dev, broken for production."_

The compounding problem: the sync pipeline ([src/lib/sync.ts](../src/lib/sync.ts)) **never creates `Enrollment` rows**, even though the schema is ready ([prisma/schema.prisma:66-76](../prisma/schema.prisma#L66-L76)). So even fixing the query to filter by enrollment would return nothing today — the data doesn't exist.

**Fix sketch:** Two parts. (a) In sync, write `Enrollment` rows when iterating Canvas sections — Canvas tells you which sections the syncing user is enrolled in via the `enrollments` array on the section or course. (b) Switch `queries.ts` to `prisma.enrollment.findMany({ where: { userId }, include: { section: { include: { course: true } } } })` and derive the course set from that.

---

### C3. README promises Supabase RLS that doesn't exist

**Where:** [README.md:33](../README.md#L33) vs [prisma/schema.prisma](../prisma/schema.prisma) (zero policies) and no `prisma/migrations/` directory.

The README states "Supabase Row Level Security enabled on all tables." It isn't. Prisma doesn't manage RLS by default — it needs raw SQL migrations. With C1 unfixed, RLS wouldn't help anyway (every request runs as the same anonymous identity).

**Fix sketch:** After C1 lands, write a SQL migration that enables RLS on every table and adds `auth.uid() = userId`-style policies. Supabase's docs cover the pattern. Plumb the user's Supabase JWT through Prisma using `set_config('request.jwt.claims', ...)` per-transaction, or move sensitive reads to the Supabase JS client which carries the JWT.

---

### C4. Sync has no DB transaction

**Where:** [src/lib/sync.ts:38-153](../src/lib/sync.ts#L38-L153) — entire function body, no `prisma.$transaction`

The pipeline upserts the school, then the user (bumping `lastSyncedAt`!), then iterates many courses, fetching sections + assignments from Canvas and writing them sequentially. If Canvas 502s on course 3 of 8, courses 1-2 are committed, course 3's partial sections might be committed, the user is marked `lastSyncedAt = now`, and the next sync attempt has no way to know it's resuming a broken state.

There is also no retry logic ([canvas.ts:60-67](../src/lib/canvas.ts#L60-L67) throws immediately on `!response.ok`).

**Fix sketch:** Two options. (a) Wrap the whole sync in `prisma.$transaction([...])` with `maxWait`/`timeout` set generously — simplest but holds a transaction for the whole Canvas round-trip duration. (b) Per-course transactions, and only update `user.lastSyncedAt` after all courses have committed successfully. Either way, add exponential backoff in `canvasFetch` for 5xx and 429 (Canvas rate limit).

---

### C5. Email is the user identity primary key

**Where:** [src/lib/sync.ts:46](../src/lib/sync.ts#L46) (`primary_email ?? email ?? canvas-${id}@unknown.local`) + [prisma/schema.prisma:23](../prisma/schema.prisma#L23) (`email String @unique`) + [sync.ts:61](../src/lib/sync.ts#L61) (`upsert.where: { email }`)

Two failure modes:

1. **Email change:** A student's school changes their email (graduation, name change, switch from `firstlast` to `firstname.lastname` convention). Next sync creates a brand-new User row — old enrollments, posts, study guides orphaned.
2. **Email-less Canvas users:** The `canvas-${id}@unknown.local` fallback means two users at different schools with no Canvas email and the same Canvas user ID would collide on... actually they wouldn't, because Canvas user IDs are per-instance and `id` here is the Canvas numeric ID. But it's a fake email written to the DB, which is itself bad — it'll fail validation on any future "email this user" feature.

**Fix sketch:** Make `(schoolId, canvasUserId)` the composite unique key for upserting users. `email` should still be unique within a school (or globally) but not the lookup key. Drop the unknown.local fallback — if Canvas can't tell us an email, fail loudly rather than write garbage.

---

### C6. Rate limiting is defined but never enforced

**Where:** [src/lib/ratelimit.ts](../src/lib/ratelimit.ts) — exports `studyGuideLimit`, `apiLimit`, `canvasSyncLimit` — and nothing imports them anywhere in the codebase.

There are no API routes yet, so this isn't biting today, but it will bite the first day an AI study guide endpoint goes live without remembering to wire the limiter.

**Fix sketch:** When the first API route lands, also build a tiny `withRateLimit(limiter)` route handler wrapper, and use it on every route by default. Make the per-user key derivation a one-liner — the easiest possible way to forget is to make it manual.

---

### C7. No middleware → API routes will be wide open by default

**Where:** No `middleware.ts` exists at project root.

Once API routes start landing, the Next.js default is that every route is public. There's no session check, no CSRF protection, nothing forcing route handlers to authenticate.

**Fix sketch:** Add `middleware.ts` matching `/api/*` and the `/` (dashboard) routes; redirect to `/login` if no NextAuth session. Lands together with C1.

---

### C8. Sync never writes `Enrollment` rows

**Where:** [src/lib/sync.ts:95-114](../src/lib/sync.ts#L95-L114) — section loop only writes `Section` rows, never `Enrollment`.

This is the data-side half of C2 (the query-side half being the school-vs-enrollment filter). Without enrollment rows, the section-scoped community feed is also impossible — there's no way to know which sections to show posts from.

**Fix sketch:** In the same section loop, after `prisma.section.update/create`, also `prisma.enrollment.upsert({ where: { userId_sectionId: { userId, sectionId } }, ... })` for the syncing user. Canvas tells you which sections the user is enrolled in via the `enrollments` array on the course `getCourses` response.

---

## Important

### I1. No error tracking

**Where:** Nothing. No Sentry SDK in [package.json](../package.json), no init code anywhere.

The README's security section mentions infrastructure protection but never observability. With minors' data, a solo founder, and no tests, **silent failures are unacceptable**. The first time a Canvas sync starts throwing on real student tokens at scale, Sam will only know because students complain.

**Fix sketch:** `npm install @sentry/nextjs`, run their wizard, init in `instrumentation.ts` (Next 15+ pattern). Free tier covers launch volume. Add `Sentry.captureException` to the catch block of the sync pipeline.

---

### I2. No tests, no test framework

**Where:** [package.json](../package.json) — zero test deps. No `tests/`, no `*.test.ts` files.

The two pieces of code most worth testing are:

- [src/lib/encryption.ts](../src/lib/encryption.ts) — a bug here corrupts every Canvas token in production with no way to recover
- [src/lib/sync.ts](../src/lib/sync.ts) — the data flow most likely to silently get wrong values into the DB

**Fix sketch:** `npm install -D vitest @vitest/ui`, add a `tests/` folder, start with `encryption.test.ts` (roundtrip + tampered-tag rejection) and `sync.test.ts` against a mocked Canvas + a Postgres test DB (Supabase has a branch-DB pattern that works for this).

---

### I3. No CI

**Where:** No `.github/` directory.

Typecheck + lint should run on every PR. Eventually tests too.

**Fix sketch:** One `.github/workflows/ci.yml` that runs `npm ci`, `npx tsc --noEmit`, `npm run lint`, and (when I2 lands) `npm test`. Vercel preview deploys are not a substitute — they don't fail-close on type errors with `next build --turbopack` in some configurations.

---

### I4. No `.env.example`

**Where:** Project root has no `.env.example` file.

Every variable read by code (see [ARCHITECTURE.md §10](./ARCHITECTURE.md#10-environment-variables)) needs to be discoverable by a future contributor (including future-Claude in a fresh session).

**Fix sketch:** Write `.env.example` with every variable name from `.env`, dummy/placeholder values, and a one-line comment per var. Commit it.

---

### I5. `CANVAS_DEV_TOKEN` (or equivalent) is a single point of compromise in dev

**Where:** Dev sync runs against a personal Canvas API token stored in `.env`. The `.env` itself is properly gitignored ([.gitignore:34](../.gitignore#L34)), but the token is one filesystem leak away from full read access to Sam's Canvas account.

**Fix sketch:** This is acceptable for solo dev as long as the token is scoped narrowly and rotated when auth lands. Add an `audit.log`-style record (or a memory note) of the date the token was last rotated. Replace entirely with OAuth-issued per-user tokens once C1 ships.

---

### I6. No token refresh flow

**Where:** [prisma/schema.prisma:28](../prisma/schema.prisma#L28) — `accessTokenExpiresAt DateTime?` exists, but no code reads or writes it.

Canvas OAuth access tokens expire (the refresh token is the long-lived one). Without a refresh flow, the first time a stored token expires, every Canvas call for that user starts 401-ing. Silently.

**Fix sketch:** After C1, on every sync attempt, check `accessTokenExpiresAt`; if expired or within 5 minutes of expiry, hit the Canvas `/login/oauth2/token` refresh endpoint, re-encrypt, persist both the new token and the new expiry.

---

### I7. No structured logging

**Where:** No logger anywhere. The `durationMs` returned from [sync.ts:151](../src/lib/sync.ts#L151) is the only metric-shaped data; nothing prints it.

**Fix sketch:** Pick `pino` (lightweight, JSON-by-default, plays well with Vercel logs). Wrap every Canvas call, sync attempt, and (future) API route with structured log lines. Don't reach for a full APM yet — `pino` + Vercel logs + Sentry covers launch.

---

### I8. Hardcoded Canvas base URL won't survive multi-school

**Where:** [src/lib/canvas.ts:1](../src/lib/canvas.ts#L1) reads `CANVAS_BASE_URL` from env at module load.

The schema models a `School.canvasUrl` per row ([schema.prisma:14](../prisma/schema.prisma#L14)) — multi-tenant ready. But the Canvas client is hardcoded to one URL via env, so the second school cannot be added without rearchitecting the canvas module.

**Fix sketch:** Change `canvasFetch` to accept a `baseUrl` parameter. Plumb it from `sync.ts` (which already gets `canvasBaseUrl` from the caller). Remove the module-load env check. The env var stays useful as a "default" for the dev token path but stops being load-bearing.

---

### I9. Prisma connection pool unconfigured

**Where:** [src/lib/prisma.ts:7](../src/lib/prisma.ts#L7) — `new PrismaClient()` with defaults.

Supabase's `pgbouncer=true` query string covers the DB-side pooling, but the Prisma client's own `connection_limit` defaults can still cause "too many connections" errors under load (especially with serverless cold starts on Vercel).

**Fix sketch:** Add `?connection_limit=1&pool_timeout=10` to `DATABASE_URL` for serverless deployments, per Prisma's Vercel guide. Document in `.env.example`.

---

### I10. Zod is in deps but never used

**Where:** [package.json:23](../package.json#L23) lists `zod ^4.4.3`, but `grep -r "from 'zod'" src/` returns nothing.

Once API routes start landing, **every** body / query / param needs Zod validation. The temptation to skip "just for the first endpoint" is the temptation to ship an injection vuln. Establish the pattern before the first route exists.

**Fix sketch:** When writing the first API route, also write `src/lib/api/withValidation.ts` that wraps `(schema, handler) => (req) => { const parsed = schema.safeParse(...); if (!parsed.success) return 400; return handler(parsed.data, req); }`. Use it everywhere.

---

### I11. `audit.txt` (346 KB bundled source dump) is committed

**Where:** [audit.txt](../audit.txt). Added in commit `02938c9` (`cleanup: remove dead code, fix globals.css, document multi-user TODO`). It's a concatenated dump of project source files — looks like output from a prior code-review tool. Not sensitive, but pollutes the repo, confuses future readers, and bloats the working tree.

**Fix sketch:** `git rm audit.txt`, add `audit.txt` to `.gitignore`. Or if it's useful, rename to `.tmp/audit.txt` and ignore the `.tmp/` directory.

---

### I12. No HTTP security headers

**Where:** [next.config.ts](../next.config.ts) is empty (just `{}`).

[README.md:37](../README.md#L37) claims "strict security headers." None are set. With minors' data and a future cookie-based session, you want CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy at minimum.

**Fix sketch:** Add a `headers()` function in `next.config.ts`. Start with the [Next.js security headers preset](https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy) and tighten CSP after the first end-to-end test of any third-party scripts (Sentry, analytics, etc.).

---

### I13. `DailyLimit.userId` has no foreign key

**Where:** [prisma/schema.prisma:118-124](../prisma/schema.prisma#L118-L124)

`userId String @unique` has no `@relation(fields: [userId], references: [id])` and no corresponding back-relation on `User`. So:

- Deleting a `User` leaves an orphan `DailyLimit` row.
- Prisma can't `include` a user from a `DailyLimit` query.
- A typo in `userId` won't fail at insert time.

**Fix sketch:** Add `user User @relation(fields: [userId], references: [id], onDelete: Cascade)`. Add `dailyLimit DailyLimit?` on `User`. Write a one-shot SQL migration that adds the FK constraint and orphan-cleans.

---

### I14. No GDPR/FERPA delete path

**Where:** No `deleteUser(userId)` function anywhere. Cascade deletes are not declared on most relations in the schema.

A student has a right to request deletion of their data. This must exist before public launch even at one school — a parent asking for it on day 2 isn't a hypothetical.

**Fix sketch:** Add `onDelete: Cascade` to every `@relation` that should follow the user (`Enrollment`, `Post`, `StudyGuide`, `DailyLimit`). For `User.encryptedRefreshToken`, deletion is automatic with the user row. Write a `deleteUserCompletely(userId)` function and a delete-account API route. Document the deletion timeline (e.g. "within 30 days") in a privacy policy.

---

### I15. Sync's count return values are misleading

**Where:** [src/lib/sync.ts:80-82, 86, 113, 142](../src/lib/sync.ts#L80-L82) — `coursesAdded` / `sectionsAdded` / `assignmentsAdded` increment for every processed row whether it was an insert or an update.

The return key suggests delta; the value is total processed. A future log line ("synced 47 new assignments") will be wrong every time.

**Fix sketch:** Either rename to `coursesSynced` / etc., or actually distinguish (`added` vs `updated`) by checking whether `findFirst` returned null.

---

## Minor

### M1. No retry / backoff on Canvas calls

**Where:** [src/lib/canvas.ts:60-67](../src/lib/canvas.ts#L60-L67) — single failed `fetch` throws immediately.

Canvas occasionally 5xx's, and rate-limits with 429 on heavy syncs. Bundle this fix with C4.

### M2. Canvas error message truncated at 200 chars

**Where:** [src/lib/canvas.ts:64](../src/lib/canvas.ts#L64) — `text.slice(0, 200)` keeps logs tidy but hides debug detail.

Add a `DEBUG_CANVAS=1` env that disables the truncation, or always log the full response body to a structured logger while keeping the thrown error message short.

### M3. Seed assignment `canvasId` is collision-prone in principle

**Where:** [src/lib/seed.ts:136](../src/lib/seed.ts#L136) — `test_${courseId}_${slugified name}`. Today's hardcoded course list has no duplicate names, but a future template that adds two "Reading Quiz" assignments to the same course would silently collide on the unique check ([sync.ts:118-120](../src/lib/sync.ts#L118-L120) does `findFirst` by `canvasId+courseId`, then update; the second one would overwrite the first).

Append an index suffix.

### M4. Hardcoded 30-day window

**Where:** [src/lib/queries.ts:28, L35](../src/lib/queries.ts#L28) — `30 * 24 * 60 * 60 * 1000`. Should be a named constant; eventually a user preference.

### M5. ThemeToggle hydration placeholder

**Where:** [src/components/theme-toggle.tsx:13](../src/components/theme-toggle.tsx#L13) — returns an unstyled `<div class="h-9 w-9" />` before mount.

Works, but a skeleton-styled button (border + radial gradient) would look intentional rather than absent during the half-second before hydration.

### M6. `force-dynamic` on the dashboard

**Where:** [src/app/page.tsx:6](../src/app/page.tsx#L6) — disables all edge caching for the only page.

Acceptable today (data is per-user and changes constantly). Worth revisiting at scale; partial route caching might let static shell + dynamic data slot in.

### M7. `AGENTS.md` is one paragraph

**Where:** [AGENTS.md](../AGENTS.md) — 5 lines, only warns about Next.js version drift. As the project has grown, this could include: brand color, naming conventions, the dev user ID hack, the "all sync writes are upserts" rule, etc.

### M8. Default Next.js favicon still in place

**Where:** [src/app/favicon.ico](../src/app/favicon.ico). Brand identity is otherwise crisp (lime `#B5FF3D` "L" logo on the dashboard) — favicon should match.

### M9. Dead `public/` SVGs

**Where:** [public/file.svg](../public/file.svg), [globe.svg](../public/globe.svg), [next.svg](../public/next.svg), [vercel.svg](../public/vercel.svg), [window.svg](../public/window.svg). Default `create-next-app` starter assets, used nowhere. `git rm`.

### M10. No `prisma/migrations/` directory

**Where:** Only `prisma/schema.prisma` exists. Either Sam is using `prisma db push` (fine for solo dev, lossy for prod) or the migrations folder was gitignored. Before launch, switch to `prisma migrate` and commit the history so prod schema drift is recoverable.

### M11. CanvasCourse interface has unused fields

**Where:** [src/lib/canvas.ts:142-149](../src/lib/canvas.ts#L142-L149) — `computed_final_score`, `computed_final_grade` are typed but never persisted ([sync.ts:168-169](../src/lib/sync.ts#L168-L169) only reads `current` variants). Either add `finalGrade` / `finalScore` columns to `Course` (useful end-of-semester) or drop the unused interface fields.

### M12. Greeting/relative date computation runs at server-render time

**Where:** [src/app/page.tsx:36-47, 65-66](../src/app/page.tsx#L36-L47) — `new Date()` in a Server Component renders the server's timezone, not the student's. Today this works because Sam's dev box and Vercel both render in UTC-ish; a student in a different timezone might see "Good evening" at 4pm.

Defer the greeting + "Today/Tomorrow" computation to a Client Component that uses the browser's local time.

---

## Summary count

- **Critical:** 8 (C1–C8)
- **Important:** 15 (I1–I15)
- **Minor:** 12 (M1–M12)

The Critical bucket is dominated by one root cause — **there is no auth yet**. C1, C2, C5, C6, C7, C8 all dissolve or shrink dramatically once authentication and the enrollment-write fix land together. Sequencing in [ROADMAP.md](./ROADMAP.md).
