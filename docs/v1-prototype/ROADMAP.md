# Ledger — Roadmap to Soft Launch

_As of 2026-05-24. Target soft launch: mid-August 2026 at Dripping Springs High School. That's roughly **12 weeks**._

Companion to [ARCHITECTURE.md](./ARCHITECTURE.md) (what exists) and [ISSUES.md](./ISSUES.md) (what's wrong). Issue codes (`C1`, `I3`, `M2`) below link back to that doc.

## The shape of this roadmap

The ordering principle is **"correctness before features."** The codebase has more feature scaffolding than feature reality, and the most production-broken things are foundational. Specifically: there is no auth. Until auth exists, nothing about authorization, RLS, rate limiting, AI quotas, or per-section feeds can be honestly built — every "user" is the same hardcoded ID, every check is meaningless.

So Phase 1 is unblocking: auth and the data-side fix that makes authorization possible. Only then can the product layers stack on top.

The honest tradeoff: **roughly 4 weeks of work before there's any new user-facing feature.** That's painful for solo-founder motivation but unavoidable. The alternative is building social/AI on top of a broken authorization model and ripping it out later.

---

## Phase 1 — Stop the bleeding (Weeks 1–2)

The "if a user touched this today, what would break or leak" list.

### 1. NextAuth + Canvas OAuth provider _(closes C1, partial C5)_

**Why first:** Nothing else is real until users are real. Every other Critical issue assumes "the system knows who's making the request" — and it doesn't.

**What:** Custom NextAuth OAuth2 provider for Canvas. Move the dev token flow into a "log in with Canvas" button. Use `@auth/prisma-adapter` (already installed) for session storage.

**Tradeoff:** Canvas at Dripping Springs ISD requires a district-issued OAuth app (developer key). Provisioning takes time and political capital. Start by hitting `dsisd.instructure.com` with a personal Canvas OAuth app (which works for one user) while the district application is in flight. Switch keys when the district one comes through.

**Verification:** Log in as yourself; verify session cookie; verify `page.tsx` reads user from session not `DEV_USER_ID`.

### 2. Write `Enrollment` rows in sync + filter queries by enrollment _(closes C2, C8)_

**Why bundled with #1:** The query-side fix is one line, but it depends on the data-side fix (which depends on auth, because sync currently uses a dev token). All three land together or none of them are real.

**What:**
- In [src/lib/sync.ts:95-114](../src/lib/sync.ts#L95-L114), after each section upsert, also upsert an `Enrollment` row for the syncing user.
- In [src/lib/queries.ts:22-25](../src/lib/queries.ts#L22-L25), switch the course query to derive from `prisma.enrollment.findMany({ where: { userId } })`.
- Delete the TODO comment.

**Tradeoff:** Canvas' `getCourses` response includes an `enrollments` array, but it represents the requesting user's enrollments — for the section endpoint, you need to confirm the user is in those sections. May need an extra `enrollment_state=active` query param. Test with a real Canvas account that's in 5+ sections.

### 3. Error tracking with Sentry _(closes I1)_

**Why now:** Auth + sync changes will introduce subtle bugs. A solo founder cannot afford for the first 50 users to be a silent quality test.

**What:** `npm install @sentry/nextjs`, run wizard, init in `instrumentation.ts`. Free tier covers launch volume comfortably. Wrap the catch in `syncUserFromCanvas` with `Sentry.captureException`.

### 4. `.env.example` + a short onboarding note _(closes I4)_

**Why now:** Cheap. Unblocks future-Claude in any fresh session. Bundle with #3.

**What:** One file. Mirror every variable read by code (see [ARCHITECTURE.md §10](./ARCHITECTURE.md#10-environment-variables)). Add a brief "how to get each one" comment per var.

---

## Phase 2 — Production readiness (Weeks 3–4)

Hardening before the first real student touches the app.

### 5. Wrap sync in transactions + add Canvas retry/backoff _(closes C4, M1)_

**Why:** The most likely failure mode in production is "Canvas 5xx'd at row 7 of 12 and now the DB is half-synced." This must be atomic or resumable.

**What:** Per-course `prisma.$transaction([...])` so a course either commits in full or rolls back. Add exponential backoff for 5xx and 429 in `canvasFetch`. Update `user.lastSyncedAt` only after the whole sync completes successfully.

### 6. Token refresh flow _(closes I6)_

**Why:** Students will use this for months. Expired tokens = silent breakage = churn = bad word-of-mouth at exactly the wrong time.

**What:** On every sync attempt, check `accessTokenExpiresAt`. If within 5 minutes of expiry, hit Canvas' OAuth refresh endpoint, re-encrypt the new token + new expiry, persist. Wrap in retry logic from #5.

### 7. Test framework + tests for the load-bearing modules _(closes I2)_

**Why second-half of Phase 2:** Auth needs to exist before you can write meaningful tests for the user-facing flow. But once it does, you cannot ship without tests on `encryption.ts` and `sync.ts`.

**What:** Vitest. Start with:
- `encryption.test.ts` — roundtrip, GCM tag tampering detection, malformed ciphertext rejection
- `sync.test.ts` — mocked Canvas, real Postgres test DB; assert enrollment + course + assignment write counts; assert no rows written on Canvas 500

### 8. CI workflow _(closes I3)_

**Why:** Tests aren't real if they don't run on PR. Should also catch type errors before they hit Vercel preview.

**What:** `.github/workflows/ci.yml`. Steps: `npm ci`, `npx tsc --noEmit`, `npm run lint`, `npm test`. Run on every push.

### 9. Security headers _(closes I12)_

**Why:** Cheap to add, hard to retrofit after the first script-from-CDN is in production. Make the README honest about "strict security headers."

**What:** `headers()` function in `next.config.ts`. CSP, HSTS, X-Frame-Options DENY, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy off-by-default. Start strict, loosen only when Sentry/etc. trigger a CSP report.

### 10. Supabase RLS migration _(closes C3)_

**Why later than feels right:** With #2 done, application-level filtering is correct. RLS is defense in depth — important, but the actual safety is the query layer. Doing it after auth and after the enrollment-write fix means RLS can use `auth.uid()` against real session JWTs.

**What:** Raw SQL migration: enable RLS on every table, write per-table policies (`users` can SELECT only `WHERE id = auth.uid()`; `enrollments` can SELECT only `WHERE userId = auth.uid()`; etc.). Update README claim from aspirational to real.

---

## Phase 3 — First real feature: AI study guides (Weeks 5–6)

Now there's a system worth building features on.

### 11. API route handler template + Zod validation pattern _(closes C6, I10)_

**Why first feature:** Establishes the route handler pattern for everything that follows. The temptation to skip Zod "just this once" is the temptation to ship an injection vuln.

**What:** `src/lib/api/withValidation.ts` — wraps a route handler with Zod input parsing. `src/lib/api/withRateLimit.ts` — wraps with an Upstash limiter using the session user as the key. First API route: `POST /api/study-guides` with `{ assignmentId }` body. Use both wrappers. Make using them the path of least resistance.

### 12. Claude Haiku integration + `DailyLimit` enforcement

**Why bundled:** The quota table exists ([prisma/schema.prisma:118-124](../prisma/schema.prisma#L118-L124)) but is unused. Wire it now to avoid a "free AI for everyone" exploit even at small scale. Also fix the missing FK from issue I13 in the same migration.

**What:** Anthropic SDK install, study-guide-prompt template based on `Assignment.description` + `Assignment.name`, increment `DailyLimit.count` per generation, return 429 when over.

### 13. Study guide UI

**What:** Click an assignment in the dashboard → modal or detail page → "Generate study guide" button → display result. Save to `StudyGuide` table for reuse (so re-opening doesn't burn the daily quota).

---

## Phase 4 — Social layer (Weeks 7–9)

The part that's actually the moat.

### 14. Class community feed: read + post

**What:** `GET /api/sections/:id/posts` and `POST /api/sections/:id/posts`. Authorization check: requesting user must be enrolled in the section (which works now thanks to #2). UI: feed below the assignments list, or a separate `/sections/[id]` page.

### 15. Moderation: report flow, anonymous toggle, basic content rules

**Why before launch:** A 16-year-old founder cannot moderate posts manually. The `Post.reported` and `Post.anonymous` flags exist in the schema ([prisma/schema.prisma:99-100](../prisma/schema.prisma#L99-L100)); use them. Hide posts above N reports automatically. Have a manual review queue.

**What:** Report button on each post → set `reported = true`. Anonymous toggle on the compose form → hide author from feed renders (but keep userId in DB for moderation). Simple word-list filter for obvious offenses on submit. Plan a humans-in-the-loop review weekly for the first month.

### 16. Push notifications? _(defer if Phase 5 polish needs the time)_

Worth investigating only if assignment-due-soon nudges are clearly differentiating. Otherwise email digest via Resend (already in env) is cheaper, simpler, and gets you to launch.

---

## Phase 5 — Launch polish (Weeks 10–12)

The "make this look like a real product the day a student lands on it" pass.

### 17. Branding pass

Custom favicon ([fixes M8](./ISSUES.md#m8-default-nextjs-favicon-still-in-place)), social preview cards (`og:image`), 404 page, loading states. Remove unused `public/` SVGs ([M9](./ISSUES.md#m9-dead-public-svgs)).

### 18. First-time Canvas connect onboarding

What does a brand-new student see between "I signed up" and "my dashboard is full"? Right now: a blank page while sync runs. Design that flow: connect Canvas → animated sync progress → first dashboard render with a one-time tour.

### 19. Beta with ~10 DSISD students; fix what breaks

Pick 10 motivated students from Sam's network. Two weeks of real usage. Sentry will catch the silent ones; students will tell you about the loud ones. Plan to ship 2-3 fixes per day during this period.

### 20. FERPA/GDPR delete path _(closes I14)_

**Why must:** Required before any public launch. A parent asking for it on day 2 isn't hypothetical.

**What:** Add `onDelete: Cascade` to every relation. Write `deleteUserCompletely(userId)` function. Build `/api/account/delete` route with double confirmation. Write a 1-page privacy notice with the deletion-timeline commitment.

### 21. Logging cleanup _(I7)_, connection pool tuning _(I9)_, audit.txt cleanup _(I11)_

Drag the remaining Important / Minor issues across the line. Specifically:

- Switch to `pino` for structured logs
- Add `?connection_limit=1&pool_timeout=10` to Vercel's `DATABASE_URL`
- `git rm audit.txt` and gitignore it
- Switch `DailyLimit.userId` to a proper FK with cascade ([I13](./ISSUES.md#i13-dailylimituserid-has-no-foreign-key))
- Move sync count naming to "synced" not "added" ([I15](./ISSUES.md#i15-syncs-count-return-values-are-misleading))

---

## Explicitly cut from the launch scope

These are in the README/Sam's plans but should not be in the August launch:

- **Ledger Plus (paid tier):** No payments stack, no proof of demand, monetization is a distraction before retention is proven.
- **Nationwide AP communities:** Needs network effect from one-school launch first. Solving it before that is solving for hypothetical users.
- **Native mobile app:** Web works on phones. The web app is the MVP; native is a Series-A problem.
- **Multi-school onboarding flow:** The hardcoded `CANVAS_BASE_URL` ([I8](./ISSUES.md#i8-hardcoded-canvas-base-url-wont-survive-multi-school)) is technical debt that's fine until school #2. Don't pay it now.

---

## Honest tradeoffs to surface

- **Phase 1 produces zero user-facing progress for 2 weeks.** Foundations work. The temptation will be to jump to study guides because it's the fun feature. Resist.
- **Tests land in Phase 2, not Phase 1.** The risk is real, but auth needs to exist before there's a meaningful flow to test against. The encryption tests _could_ go earlier; ok to slot them in if Phase 1 finishes faster than expected.
- **RLS lands in Phase 2, not Phase 1.** Application-level filtering is the actual safety. RLS is belt-and-suspenders. If C2 is fixed correctly, RLS adds defense in depth but doesn't change the security posture day-to-day.
- **AI quota math is unproven.** "One free generation per user per day" sounds generous, but if Haiku output is ~3K tokens per guide and a class of 30 students all generate one... that's manageable. If usage spikes (finals week), the per-user limit doesn't bound _total_ spend. Plan to monitor token spend daily in the first month and tighten if needed.
- **Moderation is the biggest unknown.** A class feed at one Texas high school has a low-but-real risk of bullying, slurs, doxxing, or NSFW content. Phase 4.15 has the basic mechanisms but not the operational muscle. Worst case: pull the feed feature back to "off by default per school" if it gets ugly in the beta.

---

## Issue coverage check

Every Critical and Important issue from [ISSUES.md](./ISSUES.md) is addressed in a phase:

| Issue | Phase |
|---|---|
| C1 Auth | Phase 1.1 |
| C2 Course visibility | Phase 1.2 |
| C3 Missing RLS | Phase 2.10 |
| C4 No transactions | Phase 2.5 |
| C5 Email as identity key | Phase 1.1 (partial), full fix bundled |
| C6 Unwired rate limiters | Phase 3.11 |
| C7 No middleware | Phase 1.1 |
| C8 No enrollment writes | Phase 1.2 |
| I1 No error tracking | Phase 1.3 |
| I2 No tests | Phase 2.7 |
| I3 No CI | Phase 2.8 |
| I4 No `.env.example` | Phase 1.4 |
| I5 Dev token compromise risk | Resolved by Phase 1.1 |
| I6 No token refresh | Phase 2.6 |
| I7 No structured logging | Phase 5.21 |
| I8 Hardcoded Canvas URL | **Deferred** (post-launch, school #2) |
| I9 Connection pool | Phase 5.21 |
| I10 Zod unused | Phase 3.11 |
| I11 audit.txt committed | Phase 5.21 |
| I12 No security headers | Phase 2.9 |
| I13 DailyLimit FK | Phase 3.12 |
| I14 No FERPA delete path | Phase 5.20 |
| I15 Misleading sync counts | Phase 5.21 |

Minors (M1–M12) are addressed opportunistically inside whichever phase touches the surrounding code.
