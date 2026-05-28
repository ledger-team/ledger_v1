# Ledger v2 — Database Schema

*Companion to [`prisma/schema.prisma`](../../prisma/schema.prisma). Explains the design, the cascade map, the RLS architecture, and the constraints future work must honor.*

*Last updated: 2026-05-27.*

---

## Quick map

```
       ┌── Account (NextAuth)
       │
       ├── Session
       │
       ├── CanvasToken ← encrypted via AES-256-GCM, see "OAuth tokens must be encrypted"
       │
User ──┼── Enrollment ─── Section ─── Course ─── School
       │                                   │
       │                              Assignment ── StudyGuide
       │
       ├── Post (polymorphic target) ─── Reaction
       │                            └── Report
       │
       ├── DailyLimit
       │
       └── AuditLog (actorUserId nullable; row outlives the user)
```

16 tables total. Every one of them has Row Level Security enabled from migration `0002_rls`.

---

## OAuth tokens must be encrypted

**The single most load-bearing constraint in this schema.** Read this before writing any auth code.

NextAuth's `Account` table has columns named `refresh_token`, `access_token`, and `id_token`. These are mandated by the NextAuth Prisma adapter — we can't rename them. In Phase 0 they stay NULL because we use magic-link auth only (no OAuth provider issues tokens).

**When Canvas OAuth ships in a future milestone, Canvas tokens MUST NOT be persisted to those columns.** Canvas tokens give full access to a student's real academic record. They are the most sensitive data Ledger holds. They must:

1. Be encrypted with AES-256-GCM via `encrypt()` in `src/lib/crypto/encryption.ts` (Milestone D).
2. Live in the dedicated `CanvasToken` table where the ciphertext column is named `encryptedToken` and the format is `v2:<iv>:<tag>:<ciphertext>`.
3. Be decrypted only at use time, and every decryption writes an `AuditLog` row.

The NextAuth adapter's default behavior would happily persist the OAuth response straight into `Account.refresh_token` unencrypted. **The Canvas provider must override this.** The pattern (for the agent who builds OAuth):

```ts
// pseudo — actual implementation lands in Milestone F or later.
NextAuth({
  providers: [CanvasProvider({ ... })],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'canvas' && account.access_token) {
        // Persist the Canvas token encrypted, in CanvasToken — NEVER in Account.
        await persistCanvasTokenEncrypted(user.id, account.access_token)
        // Wipe the token from the Account row so it doesn't land in DB.
        account.access_token = null
        account.refresh_token = null
        account.id_token = null
      }
      return true
    },
  },
})
```

If you find Canvas tokens persisted in `Account.access_token`, **that is a P0 incident**. Audit immediately and rotate every affected token.

---

## Cascade map (FERPA delete path)

When `deleteUserCompletely(userId)` runs in Milestone H, these cascades fire automatically:

| Parent → Child | onDelete | Why |
| --- | --- | --- |
| User → Account | Cascade | OAuth links die with the user |
| User → Session | Cascade | Sessions die with the user |
| User → VerificationToken | (no FK; keyed by email) | NextAuth design — handled by email cleanup |
| User → CanvasToken | Cascade | Most sensitive data; goes with the user |
| User → Enrollment | Cascade | My enrollments are mine |
| User → Post (authored) | Cascade | Author's posts go too. If "anonymize on delete" is ever needed, swap to SetNull + sentinel user. |
| User → Reaction | Cascade | |
| User → Report | Cascade | |
| User → StudyGuide | Cascade | |
| User → DailyLimit | Cascade | Fixes v1 I13 |
| **User → AuditLog (actor)** | **SetNull** | **The audit row survives the user. `actorEmailHash` keeps a non-reversible link.** |
| School → User | SetNull | Decommissioned school doesn't delete users |
| School → Course | Cascade | Courses belong to schools |
| Course → Section | Cascade | |
| Course → Assignment | Cascade | |
| Section → Enrollment | Cascade | |
| Assignment → StudyGuide | Cascade | |
| Post (parent) → Post (child comment) | Cascade | Thread collapses |
| Post → Reaction | Cascade | |
| Post → Report | Cascade | |

**No DB-enforced FK on `Post.targetId`** — it's polymorphic. App-layer logic and (eventually) cleanup sweeps handle orphan posts if a Section or School is deleted. See § Polymorphic Post below.

---

## RLS policies (Pattern A)

### The runtime contract

Every server query that runs in a user's context goes through `withSession()` from [`src/lib/db/withSession.ts`](../../src/lib/db/withSession.ts). That wrapper:

1. Opens a transaction on the default (superuser) Prisma client.
2. `SET LOCAL ROLE app_user` — drops privilege to the non-superuser role.
3. `SET LOCAL request.jwt.claims = '{"user_id":"…","school_id":"…"}'` — populates the claims.
4. Runs the caller's queries. RLS policies read the claims via `current_user_id()` and `current_school_id()` helpers.
5. Commits or rolls back; `SET LOCAL` evaporates with the transaction.

### When to bypass RLS

The plain `prisma` import from `src/lib/db/prisma.ts` connects as the `postgres` superuser and **bypasses RLS entirely**. Use only for:

- NextAuth's Prisma adapter (it needs to look up VerificationToken before any session exists, and insert users without a user context).
- `prisma/seed.ts` and migration scripts.
- Genuinely admin operations that have no caller user (none exist in Phase 0).

If you're writing a server action triggered by a logged-in user, use `withSession()`. If you reach for `prisma` directly inside a server action, that's a bug.

### Policy summary

| Table | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| User | self only | service-role (NextAuth) | self only | self only |
| Account | own `userId` | service-role | service-role | service-role |
| Session | own `userId` | service-role | service-role | service-role |
| VerificationToken | service-role | service-role | service-role | service-role |
| School | any authenticated user (powers onboarding dropdown) | service-role | service-role | service-role |
| CanvasToken | own row | own row | own row | own row |
| Course | enrolled in a section of this course | own `schoolId` | own `schoolId` | service-role |
| Section | enrolled in this section | course in own school | course in own school | service-role |
| Enrollment | own only | own only | — | own only |
| Assignment | enrolled in a section of the course | course in own school | course in own school | service-role |
| Post | deny-all in Phase 0 | deny-all in Phase 0 | own author | own author |
| Reaction | deny-all in Phase 0 | deny-all in Phase 0 | own only | own only |
| Report | own `reporterId` | own `reporterId` | service-role | service-role |
| StudyGuide | own only | own only | own only | own only |
| DailyLimit | own only | own only | own only | service-role |
| **AuditLog** | **own `actorUserId`** | **own `actorUserId`** | **REVOKED at grant level** | **REVOKED at grant level** |

**AuditLog append-only enforcement** is layered:
1. RLS policies grant SELECT and INSERT only.
2. The grant itself is `REVOKE UPDATE, DELETE ON "AuditLog" FROM app_user` — even an injection that escapes RLS can't tamper.

The Phase 0 "deny-all on Post/Reaction" is intentional. Neither feature ships in Phase 0, and writing real policies before the feature exists is how you get policies wrong. RLS is enabled (no permissive policy = no rows) so an accidental query never sees anything; the policies open up in whichever milestone ships the feature.

### Defense in depth, not defense in single

RLS is the second line of defense. Every server query that hits user data still scopes by `session.user.id` in its `WHERE` clause. RLS exists to catch the inevitable missing `where:` — not to be the only filter.

---

## Polymorphic Post

`Post` has one row per piece of user content across many feed types. The pointer is `(targetType, targetId)`:

| `targetType` | `targetId` references | Lives in |
| --- | --- | --- |
| `SECTION` | `Section.id` | class community feed |
| `SCHOOL_HYPE_FEED` | `School.id` | schoolwide Hype Feed |
| `SCHOOL_PULSE` | `School.id` | schoolwide Pulse |
| `SCHOOL_BRACKET` | `School.id` | School Bracket polls |
| `SENIOR_WALL` | `School.id` | Senior Wall (gated on `gradYear`) |
| `POST` | `Post.id` | a comment on another post |

`parentPostId` is a separate, real foreign key to `Post.id` — comments use both `targetType=POST + targetId=<post.id>` and `parentPostId=<post.id>` for redundant clarity at query time.

### Why no FK on `targetId`

Polymorphic FKs ("this column references different tables depending on a discriminator") aren't a native Postgres feature. The options were:

- **Multiple nullable real FKs** — `sectionId String?`, `schoolFeedId String?`, etc., one of them set per row. Loud schema; adds a column every new feed type.
- **Single polymorphic `(targetType, targetId)`** (chosen) — clean schema; orphan-on-target-delete is handled in app code, not by FK.

Orphan risk is low because Section/School deletions are rare admin ops. When they happen, an app-layer cleanup sweep can `DELETE FROM Post WHERE targetType = 'SECTION' AND targetId NOT IN (SELECT id FROM Section)`. Optional Phase 1+ work.

---

## Multi-school by default

Every query that touches user data scopes by `session.user.schoolId` — never an env var. v1's `CANVAS_BASE_URL` pattern (one school hardcoded) is gone:

- `School` is a real table with `canvasUrl` as its unique key.
- `User.schoolId` is set during onboarding.
- `Course.schoolId` and `User.schoolId` together let RLS filter cross-school reads.
- The Canvas client takes the school's `canvasUrl` as a parameter (Milestone F), not from env.

Dripping Springs High School is just the first row. Adding a second school is one INSERT, not a code change.

---

## v1 lessons encoded in this schema

| v1 issue | v2 fix |
| --- | --- |
| C2 / C8 — sync never writes Enrollment, queries leak all courses | Enrollment policies + Course/Section SELECT policies require enrollment; sync will write enrollments in Milestone F |
| C3 — README promised RLS that didn't exist | RLS enabled on every table from migration 0002, before any feature uses the DB |
| C5 — email as identity key | `User.email` is unique (NextAuth requirement) but `(schoolId, canvasUserId)` is the composite identity once Canvas connects |
| I13 — `DailyLimit.userId` no FK | `DailyLimit.user` has a real FK with Cascade |
| I14 — no FERPA delete path | Cascade map above + `deleteUserCompletely()` ships in Milestone H |
| M10 — no `prisma/migrations/` | Two migrations committed, more to come; `prisma migrate` only — never `db push` |
| v1 schema-wide "no `@@index`" | Every query path has its supporting index (`Assignment(courseId, dueAt)`, `Post(targetType, targetId, createdAt)`, etc.) |

---

## Migration workflow

| Command | What it does | When to use |
| --- | --- | --- |
| `pnpm db:migrate` | `prisma migrate dev` — create new migration from schema changes and apply | Dev: schema change |
| `pnpm db:deploy` | `prisma migrate deploy` — apply pending migrations, no schema diffing | Prod (Vercel build) + CI |
| `pnpm db:seed` | Run `prisma/seed.ts` | After `db:reset`, or to top up dev data |
| `pnpm db:reset` | Reset DB to migrations-from-scratch, then seed | Dev: nuke and restart |
| `pnpm db:studio` | Open Prisma Studio | Dev: inspect data |

**Supabase pooler trap:** Prisma migrations need a real session (DDL is not pgbouncer-safe in transaction mode), so the schema uses `directUrl = env("DIRECT_URL")` for migrations. Runtime queries use `DATABASE_URL` (the pooler). Don't merge them.

**`prisma db push` is forbidden.** Even in dev. Every schema change goes through a named migration so the history is recoverable.

---

## Verification snapshot (post-Milestone B)

These were green when Milestone B was merged. If they're not green on a future PR, something has regressed:

- `pnpm prisma migrate status` — all migrations applied
- `SELECT rolname FROM pg_roles WHERE rolname = 'app_user'` → 1 row
- `SELECT COUNT(*) FROM pg_policies WHERE schemaname='public'` → ≥ 33
- `SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity = false` → empty (every app table has RLS on)
- Founder claims see only founder's data; classmate claims see only classmate's data; bogus claims see nothing
- INSERT into AuditLog claiming someone else's userId is blocked
- UPDATE on AuditLog is blocked entirely
