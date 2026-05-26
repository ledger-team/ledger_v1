# Ledger — Architecture

_As of 2026-05-24. This document describes what actually exists in the repo today, not what is planned. For known gaps, see [ISSUES.md](./ISSUES.md). For sequencing of fixes, see [ROADMAP.md](./ROADMAP.md)._

## 1. What Ledger Is

Ledger is a Canvas-synced study app and social layer for high school students. The student connects their Canvas account; Ledger pulls their real courses, sections, assignments, and grades into a per-school database, then renders a dashboard, generates AI study guides, and (eventually) hosts a class-scoped community feed.

The target launch is a soft rollout at **Dripping Springs High School (TX)** when classes start mid-August 2026, then expansion school-by-school. The data moat is the network: students at their actual school, in their actual Canvas sections.

Founder: Sam Berry, solo, age 16.

## 2. What's Built Today

A small but real slice:

| Capability | State | Where |
|---|---|---|
| Canvas REST client with pagination | ✅ Working | [src/lib/canvas.ts](../src/lib/canvas.ts) |
| AES-256-GCM token encryption | ✅ Working | [src/lib/encryption.ts](../src/lib/encryption.ts) |
| Full Canvas → DB sync pipeline | ✅ Working | [src/lib/sync.ts](../src/lib/sync.ts) |
| Prisma schema (9 models) | ✅ Working | [prisma/schema.prisma](../prisma/schema.prisma) |
| Test data seed/wipe | ✅ Working | [src/lib/seed.ts](../src/lib/seed.ts) |
| Dashboard page (server-rendered) | ✅ Working | [src/app/page.tsx](../src/app/page.tsx) |
| Dark mode (default dark) | ✅ Working | [src/components/theme-provider.tsx](../src/components/theme-provider.tsx), [src/components/theme-toggle.tsx](../src/components/theme-toggle.tsx) |
| Rate limiter definitions (Upstash) | ✅ Defined, unused | [src/lib/ratelimit.ts](../src/lib/ratelimit.ts) |
| **Authentication** | ❌ Not wired — hardcoded dev user ID | [src/app/page.tsx:4](../src/app/page.tsx#L4) |
| **API routes** | ❌ None exist | no `src/app/api/` folder |
| **Middleware** | ❌ None | no `middleware.ts` |
| **AI study guides** | ❌ Schema only | [prisma/schema.prisma:107](../prisma/schema.prisma#L107) |
| **Class community feed** | ❌ Schema only | [prisma/schema.prisma:94](../prisma/schema.prisma#L94) |
| **Token refresh flow** | ❌ Field exists, no logic | [prisma/schema.prisma:28](../prisma/schema.prisma#L28) |
| **Tests / CI** | ❌ Zero | no test framework in deps |
| **Error tracking** | ❌ Not installed | no Sentry SDK |
| **Supabase RLS** | ❌ Claimed in README, not in schema | [README.md:33](../README.md#L33) |
| **Input validation (Zod)** | ❌ Dep installed, never imported | no `import.*zod` anywhere |

The honest one-liner: **the data plumbing works end-to-end against real Canvas, but everything that turns it into a multi-user product (auth, authorization, API routes, AI, social) is not yet built.**

## 3. Tech Stack

From [package.json](../package.json):

### Runtime dependencies

| Package | Version | Used for |
|---|---|---|
| `next` | `16.2.6` | App Router framework, Turbopack bundler |
| `react`, `react-dom` | `19.2.4` | UI runtime |
| `@prisma/client` | `^5.22.0` | DB query client |
| `prisma` | `^5.22.0` | Schema/migrations CLI (kept as runtime because `postinstall` runs `prisma generate`) |
| `next-auth` | `^4.24.14` | Auth framework — **installed, never imported** |
| `@auth/prisma-adapter` | `^2.11.2` | NextAuth session storage — **installed, never imported** |
| `zod` | `^4.4.3` | Input validation — **installed, never imported** |
| `next-themes` | `^0.4.6` | Dark/light theme management |
| `@upstash/redis` | `^1.38.0` | Serverless Redis client (used by ratelimit) |
| `@upstash/ratelimit` | `^2.0.8` | Rate limit primitives (defined, not yet wired) |

### Dev dependencies

| Package | Version | Used for |
|---|---|---|
| `typescript` | `^5` | Strict-mode type checking ([tsconfig.json:7](../tsconfig.json#L7)) |
| `@tailwindcss/postcss`, `tailwindcss` | `^4` | Tailwind v4 via PostCSS |
| `eslint`, `eslint-config-next` | `^9`, `16.2.6` | Flat-config ESLint with Next rules |
| `tsx` | `^4.22.3` | Run TypeScript files directly (for one-off scripts) |
| `dotenv` | `^17.4.2` | Env loading for Prisma CLI scripts |
| `@types/node`, `@types/react`, `@types/react-dom` | `^20`, `^19`, `^19` | Type definitions |

### Notable about this stack

- **Bleeding edge across the board.** Next 16 + React 19 + Tailwind 4 are all recent majors. The repo's [CLAUDE.md](../CLAUDE.md)/[AGENTS.md](../AGENTS.md) explicitly warn: _"This is NOT the Next.js you know — read the relevant guide in `node_modules/next/dist/docs/` before writing any code."_ Treat training-data Next.js patterns as suspect.
- **No test framework** (no Jest/Vitest/Playwright). No `tests/` folder.
- **No CI** (no `.github/`).
- **No Sentry / error tracking SDK** despite the security posture promised in the README.
- **Three deps are installed and never imported yet** (`next-auth`, `@auth/prisma-adapter`, `zod`) — they are scaffolding for features Sam knows are coming.

### Build / scripts ([package.json:5-11](../package.json#L5-L11))

- `dev` → `next dev --turbopack`
- `build` → `prisma generate && next build --turbopack`
- `postinstall` → `prisma generate` (Vercel-friendly: generates the Prisma client on every install)
- `start` → `next start`
- `lint` → `eslint`

### TypeScript ([tsconfig.json](../tsconfig.json))

Standard Next 16 setup — `strict: true`, `moduleResolution: "bundler"`, `target: ES2017`, `jsx: "react-jsx"`. Path alias `@/* → src/*` ([tsconfig.json:21-23](../tsconfig.json#L21-L23)).

### Next config ([next.config.ts](../next.config.ts))

Empty. No custom headers, no rewrites, no image config, nothing. All Next defaults.

### CSS ([src/app/globals.css](../src/app/globals.css))

11 lines. Tailwind v4 `@import "tailwindcss"`, a custom `dark` variant for `next-themes` compatibility ([globals.css:3](../src/app/globals.css#L3)), system font stack.

### ESLint ([eslint.config.mjs](../eslint.config.mjs))

ESLint 9 flat config with `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`. No custom rules, no Prettier integration.

## 4. Data Model

Defined in [prisma/schema.prisma](../prisma/schema.prisma). PostgreSQL via Supabase, with a pooled `DATABASE_URL` (pgbouncer) and a `DIRECT_URL` for migrations ([schema.prisma:5-9](../prisma/schema.prisma#L5-L9)).

Nine models. The shape is Canvas-shaped on the bottom (School → Course → Section → Enrollment, plus Assignment) and product-shaped on top (Post, StudyGuide, DailyLimit).

```
School ──┬── User ──┬── Enrollment ──┐
         │          ├── Post         │
         │          └── StudyGuide ──┤
         │                            │
         └── Course ──┬── Section ────┴── Post
                     └── Assignment ──── StudyGuide
                                ↑
                         (DailyLimit → User by id, no FK)
```

### `School` ([schema.prisma:11-19](../prisma/schema.prisma#L11-L19))

| Field | Type | Notes |
|---|---|---|
| `id` | `String` (cuid) | PK |
| `name` | `String` | Display name (e.g. "Dripping Springs High School") |
| `canvasUrl` | `String @unique` | The school's Canvas instance, e.g. `https://dsisd.instructure.com`. Used as the unique key for upserting schools during sync ([sync.ts:50](../src/lib/sync.ts#L50)). |
| `createdAt` | `DateTime` | |
| Relations | `users[]`, `courses[]` | |

Schools are inferred from the Canvas instance URL during sync; there is no admin-created school list.

### `User` ([schema.prisma:21-36](../prisma/schema.prisma#L21-L36))

| Field | Type | Notes |
|---|---|---|
| `id` | `String` (cuid) | PK |
| `email` | `String @unique` | **The de-facto identity key.** Sync upserts users by email ([sync.ts:61](../src/lib/sync.ts#L61)). |
| `name` | `String` | |
| `schoolId` | `String` | FK → School |
| `canvasUserId` | `String?` | Canvas numeric ID, stored as string |
| `encryptedRefreshToken` | `String?` | **FERPA-sensitive.** AES-256-GCM ciphertext of the Canvas OAuth token. Format: `iv:cipher:tag` ([encryption.ts:18-22](../src/lib/encryption.ts#L18-L22)) |
| `accessTokenExpiresAt` | `DateTime?` | **Defined but unused** — no code reads or writes it. Implies a token-refresh flow that doesn't exist yet. |
| `lastSyncedAt` | `DateTime?` | Set on every sync |
| `createdAt` | `DateTime` | |
| Relations | `school`, `enrollments[]`, `posts[]`, `studyGuides[]` | |

**FERPA-relevant fields:** `name`, `email` (PII for minors); `encryptedRefreshToken` (auth credential for protected academic data).

### `Course` ([schema.prisma:38-52](../prisma/schema.prisma#L38-L52))

| Field | Type | Notes |
|---|---|---|
| `id` | `String` (cuid) | PK |
| `schoolId` | `String` | FK → School |
| `canvasCourseId` | `String` | Canvas numeric ID, stored as string. Not unique on its own — uniqueness is implicit via `(canvasCourseId, schoolId)` lookups in code ([sync.ts:160](../src/lib/sync.ts#L160)) but **not enforced at the DB level**. |
| `name`, `courseCode` | `String` | "AP World History", "APWORLD" |
| `currentGrade` | `String?` | Letter grade synced from Canvas (e.g. "A-") |
| `currentScore` | `Float?` | Numeric percentage |
| `lastSyncedAt`, `createdAt` | `DateTime?` / `DateTime` | |
| Relations | `school`, `sections[]`, `assignments[]` | |

**FERPA-relevant:** `currentGrade`, `currentScore` (student academic record).

### `Section` ([schema.prisma:54-64](../prisma/schema.prisma#L54-L64))

Canvas-section = a specific class period of a course. The unit that scopes community feeds (so "AP Physics, period 3" doesn't see "AP Physics, period 5"). Implicit uniqueness on `(canvasSectionId, courseId)` is again enforced only in code ([sync.ts:97](../src/lib/sync.ts#L97)), not at DB.

### `Enrollment` ([schema.prisma:66-76](../prisma/schema.prisma#L66-L76))

The student↔section join table. `@@unique([userId, sectionId])` ([schema.prisma:75](../prisma/schema.prisma#L75)) prevents duplicate enrollments.

**Critical note:** the sync pipeline never writes to this table. There is currently no code path that creates `Enrollment` rows. This means [queries.ts](../src/lib/queries.ts) can't filter by enrollments even though the schema is ready — see [ISSUES.md C2](./ISSUES.md#c2-school-scoped-course-visibility-ferpa).

### `Assignment` ([schema.prisma:78-92](../prisma/schema.prisma#L78-L92))

| Field | Type | Notes |
|---|---|---|
| `id` | `String` (cuid) | PK |
| `courseId` | `String` | FK → Course |
| `canvasId` | `String` | Canvas numeric ID as string |
| `name`, `description?` | `String`, `String?` | |
| `dueAt` | `DateTime?` | Nullable — Canvas allows assignments without due dates |
| `pointsPossible` | `Float?` | |
| `submissionType` | `String?` | First entry of Canvas' `submission_types` array ([sync.ts:126](../src/lib/sync.ts#L126)) — lossy |
| `isTestData` | `Boolean @default(false)` | Seed-data marker, see §9 |
| `createdAt` | `DateTime` | |
| Relations | `course`, `studyGuides[]` | |

Implicit uniqueness on `(canvasId, courseId)` enforced in code only ([sync.ts:119](../src/lib/sync.ts#L119)).

### `Post` ([schema.prisma:94-105](../prisma/schema.prisma#L94-L105))

Section-scoped community post. `anonymous` and `reported` boolean flags exist for moderation, but no code reads or writes this table yet.

### `StudyGuide` ([schema.prisma:107-116](../prisma/schema.prisma#L107-L116))

AI-generated study guide attached to an assignment. Schema-only; no generation logic exists.

### `DailyLimit` ([schema.prisma:118-124](../prisma/schema.prisma#L118-L124))

Per-user counter table — intended for AI study guide quota tracking (`one free per user per day`).

**Bug:** `userId` is `String @unique` but has **no `@relation` to User**. There is no FK constraint, so orphan records will persist if a user is deleted, and Prisma can't `include` a user from a `DailyLimit`. See [ISSUES.md I13](./ISSUES.md#i13-dailylimituserid-has-no-foreign-key).

### Schema-wide observations

- **No `updatedAt` anywhere except `DailyLimit`.** Audit trails / "last modified" semantics will need a migration when needed.
- **No soft-delete (`deletedAt`).** FERPA/GDPR delete requests will be hard deletes.
- **No FK declared on `Course.canvasCourseId`, `Section.canvasSectionId`, `Assignment.canvasId` uniqueness.** The DB will accept duplicates; the code prevents them by always checking with `findFirst` before insert.
- **`@@index` is absent.** No explicit indexes beyond the implicit ones from `@id` / `@unique` / `@@unique`. Queries like "all assignments due in the next 30 days for these courses" ([queries.ts:30-40](../src/lib/queries.ts#L30-L40)) will get expensive without `(courseId, dueAt)` indexes once data grows.

## 5. `src/lib/` Module-by-Module

### Dependency graph

```
                  ┌──────────────┐
                  │   prisma.ts  │ (singleton client)
                  └──────┬───────┘
        ┌────────────────┼────────────────┐
        ↓                ↓                ↓
   queries.ts        seed.ts          sync.ts
                                          │
                                          ├──→ encryption.ts
                                          └──→ canvas.ts
                                                  │
                                              (fetch only,
                                               no other deps)

ratelimit.ts   (standalone, used by nothing yet)
```

### `src/lib/prisma.ts` ([file](../src/lib/prisma.ts))

11 lines. The Next.js + Prisma boilerplate singleton — caches the `PrismaClient` on `globalThis` in non-production so the hot-reloader doesn't spawn a new client per HMR cycle ([prisma.ts:9-11](../src/lib/prisma.ts#L9-L11)).

No connection-pool tuning (uses Prisma defaults). The `DATABASE_URL` already includes `pgbouncer=true` on the Supabase side, so app-level pooling is partially deferred to the platform.

### `src/lib/canvas.ts` ([file](../src/lib/canvas.ts))

Low-level Canvas REST client. 233 lines. Reads `CANVAS_BASE_URL` from env at module load and throws if missing ([canvas.ts:1-5](../src/lib/canvas.ts#L1-L5)).

**Exports:**

| Export | Purpose |
|---|---|
| `class CanvasError` ([L7-16](../src/lib/canvas.ts#L7-L16)) | Typed error carrying `status` and `url` |
| `interface CanvasCourse` ([L135-150](../src/lib/canvas.ts#L135-L150)) | Subset of Canvas course shape, includes both current and final scores/grades |
| `interface CanvasAssignment` ([L152-161](../src/lib/canvas.ts#L152-L161)) | |
| `interface CanvasSection` ([L163-169](../src/lib/canvas.ts#L163-L169)) | |
| `getCourses(token)` ([L176-184](../src/lib/canvas.ts#L176-L184)) | All active enrollments with `total_scores` included |
| `getAssignments(token, courseId)` ([L189-202](../src/lib/canvas.ts#L189-L202)) | Ordered by `due_at` |
| `getSections(token, courseId)` ([L207-215](../src/lib/canvas.ts#L207-L215)) | |
| `getSelf(token)` ([L220-233](../src/lib/canvas.ts#L220-L233)) | `/users/self` — id, name, email, primary_email |

**Internal helpers (not exported):**

- `canvasFetch<T>` ([L29-71](../src/lib/canvas.ts#L29-L71)) — adds `Authorization: Bearer`, serializes query params (with Canvas' `key[]=val&key[]=val2` array convention at L39-43), throws `CanvasError` with the response body truncated to 200 chars
- `canvasFetchAll<T>` ([L77-120](../src/lib/canvas.ts#L77-L120)) — pagination loop. First page uses `per_page=100`; subsequent pages follow the URL from the `Link` header verbatim
- `parseNextLink` ([L122-131](../src/lib/canvas.ts#L122-L131)) — RFC 5988 `Link` header parser, looking for `rel="next"`

**Behaviors / quirks:**

- No retry / backoff on transient failures. A single 502 fails the whole sync.
- The 200-char error truncation is fine for log readability but will hide useful Canvas API error detail. No debug mode.
- `CanvasCourse.enrollments` includes both `computed_current_*` and `computed_final_*` grades — sync only persists the current pair.

### `src/lib/encryption.ts` ([file](../src/lib/encryption.ts))

AES-256-GCM authenticated encryption for the Canvas refresh token. 40 lines.

Reads `process.env.ENCRYPTION_KEY` as hex at module load; validates that the decoded length is exactly 32 bytes (256 bits) and throws otherwise ([encryption.ts:4-8](../src/lib/encryption.ts#L4-L8)).

| Export | Behavior |
|---|---|
| `encrypt(plaintext)` ([L10-23](../src/lib/encryption.ts#L10-L23)) | Generates a 16-byte random IV, encrypts, gets the GCM auth tag, returns `iv:cipher:tag` (all hex, colon-delimited) |
| `decrypt(ciphertext)` ([L25-40](../src/lib/encryption.ts#L25-L40)) | Parses the colon format, validates all three parts present, sets the auth tag (which fails if tampered), returns plaintext |

**Notes:**

- Properly uses GCM (not just AES-CTR) — tamper resistance is real.
- The serialization format is not versioned. If the algorithm ever rotates, decryption code will need to sniff format.
- No KDF — the env-provided key is used directly. If `ENCRYPTION_KEY` leaks, all stored tokens are decryptable.
- No key-rotation primitive (no way to re-encrypt all tokens under a new key).

### `src/lib/sync.ts` ([file](../src/lib/sync.ts))

The whole Canvas → DB pipeline. 177 lines.

**Single exported function:** `syncUserFromCanvas({ canvasToken, canvasBaseUrl, schoolName })` ([sync.ts:38-153](../src/lib/sync.ts#L38-L153)).

Sequence:

1. **Get Canvas user.** Calls `getSelf` → derives email with the fallback chain `primary_email ?? email ?? canvas-${id}@unknown.local` ([sync.ts:46](../src/lib/sync.ts#L46)).
2. **Upsert school** by `canvasUrl` ([L49-56](../src/lib/sync.ts#L49-L56)).
3. **Encrypt the Canvas token** and upsert user by email ([L59-76](../src/lib/sync.ts#L59-L76)). `lastSyncedAt` is bumped to `new Date()`.
4. **For each course returned by Canvas** ([L84-144](../src/lib/sync.ts#L84-L144)):
   - Upsert course via the `upsertCourse` helper ([L157-177](../src/lib/sync.ts#L157-L177))
   - Fetch sections + assignments in parallel ([L89-92](../src/lib/sync.ts#L89-L92))
   - Sequentially upsert each section ([L95-114](../src/lib/sync.ts#L95-L114)) and each assignment ([L117-143](../src/lib/sync.ts#L117-L143)) via `findFirst → update | create` (not Prisma's `upsert` — explicit so the caller controls the lookup key)
5. **Return counts + duration** ([L146-152](../src/lib/sync.ts#L146-L152))

**Behaviors / quirks:**

- **Not transactional.** No `prisma.$transaction(...)` wraps any of this. If Canvas 5xx's on course #3 of 8, courses 1-2 stay written and the user's `lastSyncedAt` is already updated. See [ISSUES.md C4](./ISSUES.md#c4-sync-has-no-db-transaction).
- **`coursesAdded` / `sectionsAdded` / `assignmentsAdded` counters are misnamed** — they increment for every processed row, whether new or updated ([L86, L113, L142](../src/lib/sync.ts#L86)). The return name implies a delta; the value is a total.
- **`submission_types` array is reduced to its first element** ([L126](../src/lib/sync.ts#L126)) — lossy, but reasonable for the dashboard's needs.
- **Never creates `Enrollment` rows.** The student↔section relationship is silently never recorded — only courses, sections, and assignments are written. This is the root of the FERPA-relevant filtering bug in `queries.ts`.
- **No retry on Canvas errors.** A single 502 anywhere aborts. Combined with non-atomicity, this is the most likely production failure mode.

### `src/lib/queries.ts` ([file](../src/lib/queries.ts))

46 lines. One exported function.

**`getDashboardData(userId)`** ([queries.ts:9-46](../src/lib/queries.ts#L9-L46)):

1. Load the user with their school included ([L10-13](../src/lib/queries.ts#L10-L13)); throw if not found.
2. Load **all courses at the user's school** ([L22-25](../src/lib/queries.ts#L22-L25)) — **not filtered by enrollment**. This is a known bug, called out in a TODO comment at [L19-21](../src/lib/queries.ts#L19-L21):
   > _"TODO: when we have auth, filter courses by the user's enrollments, not just their school. Right now every user at a school sees every course at that school — fine for dev, broken for production."_
3. Load all assignments due in the **next 30 days** for that course set, with the course included, sorted by `dueAt` ascending ([L30-40](../src/lib/queries.ts#L30-L40)).
4. Return `{ user, courses, upcomingAssignments }`.

The 30-day window is hardcoded ([L28, L35](../src/lib/queries.ts#L28)). Not configurable per user.

### `src/lib/seed.ts` ([file](../src/lib/seed.ts))

Dev/demo data generator. 175 lines.

**Exports:**

- `seedTestData({ userId })` ([seed.ts:22-150](../src/lib/seed.ts#L22-L150)) — wipes existing test data for the user's school, then creates 4 hardcoded AP-style courses with 5-6 realistic assignments each (with full description text — see [L58-93](../src/lib/seed.ts#L58-L93) for the kind of detail). Marks every assignment `isTestData: true` ([L142](../src/lib/seed.ts#L142)) and every course with `canvasCourseId` starting with `test_` ([L52, L67, L81, L96](../src/lib/seed.ts#L52)).
- `wipeTestData(userId)` ([seed.ts:156-175](../src/lib/seed.ts#L156-L175)) — deletes all test assignments + test courses for the user's school.

The synthetic assignment `canvasId` is `test_${courseId}_${slugified name}` ([L136](../src/lib/seed.ts#L136)). Two assignments with the same name in the same course would collide; in practice every test name is unique so this is fine today.

The set of courses is hardcoded — there's no way to customize the seed for, say, a non-AP student profile.

### `src/lib/ratelimit.ts` ([file](../src/lib/ratelimit.ts))

27 lines. Three Upstash `Ratelimit` instances and a `redis` re-export. Redis client constructed with `Redis.fromEnv()` ([ratelimit.ts:4](../src/lib/ratelimit.ts#L4)), pulling `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` from env.

| Limiter | Window | Strategy | Prefix |
|---|---|---|---|
| `studyGuideLimit` | 1 / 24 h | fixed window | `ratelimit:study-guide` |
| `apiLimit` | 60 / 1 min | sliding window | `ratelimit:api` |
| `canvasSyncLimit` | 1 / 30 min | fixed window | `ratelimit:canvas-sync` |

**Currently unused** — no code imports any of them. They're scaffolding waiting for API routes.

Note: the prefix is set, but the per-user identifier must be passed by the caller (via `.limit(key)`); there's no helper that wires "current user" → key. Easy to get wrong when the first API route is built.

## 6. Dashboard Rendering Flow

The only page in the app today is the dashboard at `/` ([src/app/page.tsx](../src/app/page.tsx)).

```
Request to /
       ↓
RootLayout (src/app/layout.tsx)
  ↓ wraps in <html><body><ThemeProvider>
DashboardPage (src/app/page.tsx) — Server Component
  ↓ async, force-dynamic (page.tsx:6)
  ↓ const { user, courses, upcomingAssignments } = 
  ↓   await getDashboardData(DEV_USER_ID)   ← hardcoded ID, page.tsx:4
  ↓
queries.ts → prisma → Postgres
       ↑
       └─── returns data
       ↓
In-component grouping:
  - byDay: Map<dateString, assignment[]>  (page.tsx:52-59)
  - sortedDays: array of [dateString, assignments] sorted ascending (page.tsx:60-62)
  - greeting derived from new Date().getHours() (page.tsx:65-66)
       ↓
JSX renders:
  - Sticky nav (logo, user name + school, ThemeToggle, avatar)
  - Greeting + count of upcoming
  - Class cards grid: courseCode, name, currentGrade (color-coded by gradeColor() L8-14)
  - "What's Coming Up": grouped by relative date ("Today" / "Tomorrow" / weekday / Mar 5)
    - urgencyStyles() L16-34 adds red border + "DUE SOON" if <24h, amber + "THIS WEEK" if <72h
  - Footer: "Last synced ..." from user.lastSyncedAt
```

Key implementation details:

- **`export const dynamic = 'force-dynamic'`** ([page.tsx:6](../src/app/page.tsx#L6)) — every request re-queries Postgres. No edge caching. Acceptable today; revisit at scale.
- **The dev user ID** is the literal string `'cmpix1ayn0002pu98c3npnk4b'` ([page.tsx:4](../src/app/page.tsx#L4)). Every visitor "is" this user. Removing this is gated on auth.
- All the visual styling lives in inline Tailwind classes — no extracted card / button components yet.

## 7. Components & Theming

### `src/components/theme-provider.tsx` ([file](../src/components/theme-provider.tsx))

11 lines. A pure pass-through wrapper around `next-themes`' `ThemeProvider` that marks it as a Client Component (the only way to use it from a Server Component layout).

### `src/components/theme-toggle.tsx` ([file](../src/components/theme-toggle.tsx))

The light/dark toggle button. Uses the standard `next-themes` hydration trick: until `mounted` is true, render a placeholder `<div class="h-9 w-9" />` that reserves space so the layout doesn't shift ([theme-toggle.tsx:10-14](../src/components/theme-toggle.tsx#L10-L14)). After mount, render a button with two stacked SVGs (sun + moon) that rotate/fade between states ([L18-55](../src/components/theme-toggle.tsx#L18-L55)).

### Styling system

- Tailwind v4 via the `@tailwindcss/postcss` plugin ([postcss.config.mjs](../postcss.config.mjs)).
- Default theme is **dark** ([layout.tsx:20](../src/app/layout.tsx#L20)) with `enableSystem` ([L21](../src/app/layout.tsx#L21)) so the system preference is honored once the user toggles.
- Brand accent color: **lime `#B5FF3D`** — used for the logo background ([page.tsx:74](../src/app/page.tsx#L74)), the greeting line ([page.tsx:94-95](../src/app/page.tsx#L94-L95)), and the upcoming-count number ([page.tsx:99](../src/app/page.tsx#L99)).
- Semantic colors via Tailwind palette: `lime` (90+), `amber` (warning / 70-79), `rose` (urgent / <70 or <24h).
- No icon library — the two SVGs in `theme-toggle.tsx` are hand-rolled.

## 8. Security Architecture (Today)

What is actually protected:

- **Canvas refresh tokens at rest:** AES-256-GCM, 256-bit key, random 16-byte IV per ciphertext, authenticated with the GCM tag. Solid.
- **Database credentials:** Supabase pgbouncer connection over TLS (URL has `sslmode=require` on `DIRECT_URL`).
- **`.env` is gitignored** ([.gitignore:34](../.gitignore#L34) covers `.env*`). Verified that no `.env*` is tracked.

What the [README.md](../README.md) **claims** is protected, but **isn't**:

| README claim | Reality |
|---|---|
| [README.md:33](../README.md#L33) "Supabase Row Level Security enabled on all tables" | Schema has zero RLS policies. There are no `prisma/migrations/` files defining policies either. |
| [README.md:34](../README.md#L34) "All API input validated with Zod" | Zod is in `package.json` but `import.*zod` returns zero matches across the codebase. No API routes yet, so there's also no input to validate. |
| [README.md:35](../README.md#L35) "Authentication and authorization checked on every protected route" | No authentication exists. There are no protected routes. Visitors are auto-logged-in as a hardcoded dev user. |
| [README.md:36](../README.md#L36) "Rate limiting enforced server-side on AI endpoints" | Limiters are defined ([ratelimit.ts](../src/lib/ratelimit.ts)) but never imported. No AI endpoints exist. |
| [README.md:37](../README.md#L37) "HTTPS only, with strict security headers" | [next.config.ts](../next.config.ts) is empty — no `headers()` function, no CSP, HSTS, X-Frame-Options, Referrer-Policy, etc. HTTPS is enforced by Vercel but the headers part is unimplemented. |

These are best read as Sam's **intent** (and what an honest README will say at launch), not what's currently shipping. See [ISSUES.md](./ISSUES.md) for severity rankings.

## 9. Dev/Prod Data Separation

There is no separate test database. Dev and (eventual) prod data sit in the same Supabase instance.

The separation strategy is a per-row marker:

- **`Assignment.isTestData: Boolean`** ([schema.prisma:87](../prisma/schema.prisma#L87))
- **`Course.canvasCourseId` starting with `test_`** ([seed.ts:45](../src/lib/seed.ts#L45), [L170](../src/lib/seed.ts#L170))

`seedTestData` / `wipeTestData` use these markers to recreate or remove demo data without touching real Canvas-synced data. Idempotent: running `seedTestData` twice produces the same end state.

This is a fine pattern for solo dev; will not survive multi-tenant production. At launch this should become a real per-environment DB.

## 10. Environment Variables

Variables read by code (some are in [.env](../.env) — gitignored, not in the repo):

| Variable | Read at | Purpose |
|---|---|---|
| `DATABASE_URL` | `prisma/schema.prisma` datasource | Pooled (pgbouncer) Postgres connection |
| `DIRECT_URL` | `prisma/schema.prisma` datasource | Direct Postgres connection for migrations |
| `ENCRYPTION_KEY` | [encryption.ts:4](../src/lib/encryption.ts#L4) | 64-char hex (32-byte) AES-256-GCM key |
| `CANVAS_BASE_URL` | [canvas.ts:1](../src/lib/canvas.ts#L1) | Canvas instance URL — **hardcoded to one school today** |
| `UPSTASH_REDIS_REST_URL` | [ratelimit.ts:4](../src/lib/ratelimit.ts#L4) via `Redis.fromEnv()` | Upstash Redis endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | same | Upstash Redis auth |
| `NODE_ENV` | [prisma.ts:9](../src/lib/prisma.ts#L9) | Dev-only globalThis caching gate |

Variables referenced in the deployed/ops surface but not in code yet:

- `NEXTAUTH_SECRET`, `NEXTAUTH_URL` — when NextAuth is wired up
- `RESEND_API_KEY`, `EMAIL_FROM` — when transactional email lands

No `.env.example` exists. See [ISSUES.md I4](./ISSUES.md#i4-no-envexample).

## 11. Project file layout (tracked files only — 30 total)

```
.gitignore
AGENTS.md            ← Next.js 16 agent warning
CLAUDE.md            ← @AGENTS.md
README.md            ← public-facing description (security claims aspirational)
audit.txt            ← 346 KB bundled source dump from a prior tool run — shouldn't be tracked
eslint.config.mjs
next.config.ts       ← empty
package.json
package-lock.json
postcss.config.mjs
tsconfig.json
prisma/
  schema.prisma
public/
  file.svg globe.svg next.svg vercel.svg window.svg   ← unused Next.js starter assets
src/
  app/
    favicon.ico      ← default Next.js favicon
    globals.css
    layout.tsx
    page.tsx
  components/
    theme-provider.tsx
    theme-toggle.tsx
  lib/
    canvas.ts encryption.ts prisma.ts queries.ts ratelimit.ts seed.ts sync.ts
```

No `src/app/api/`, no `middleware.ts`, no `tests/`, no `.github/`, no `prisma/migrations/`.
