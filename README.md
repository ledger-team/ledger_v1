# Ledger

The operating system for high school life. Canvas-synced study app + social platform for students.

**Status:** Phase 0 — foundation build in progress. Not yet usable. See [`docs/STATUS.md`](./docs/STATUS.md) for what's working and what's next.

## Documents

- [`docs/FOUNDATION.md`](./docs/FOUNDATION.md) — architectural floor for v2. The most important document in the repo.
- [`docs/PHASE_0_PLAN.md`](./docs/PHASE_0_PLAN.md) — Phase 0 implementation plan, decisions, and verification checklist.
- [`docs/STATUS.md`](./docs/STATUS.md) — what's working, what's broken, what's in progress.
- [`docs/v1-prototype/`](./docs/v1-prototype/) — reference docs from the v1 prototype: architecture, known issues, and roadmap.

## Quickstart

Requires **Node 24** (LTS) and **pnpm 10+**.

```bash
# install dependencies
pnpm install

# run the dev server
pnpm dev

# typecheck / lint / test
pnpm typecheck
pnpm lint
pnpm test
```

Open <http://localhost:3000>.

## Environment

Copy `.env.example` to `.env` and fill in the values. Every variable read by code appears in `.env.example` with a comment explaining what it is. (Empty in Milestone A — populated as each subsequent milestone adds dependencies.)

## Tech stack

- **Next.js 15** (App Router) + **React 19**
- **TypeScript** in strict mode
- **Tailwind v4** (CSS-first config)
- **Vitest** for unit + integration tests
- **pnpm** as the package manager

Each subsequent milestone adds: Prisma + Supabase (B), Pino + Sentry + PostHog (C), encryption + Upstash + Zod (D), NextAuth (E), Canvas client (F), and so on. Full plan in `docs/PHASE_0_PLAN.md`.

## Project structure

```
.
├── docs/                      ← spec, plan, status, v1 reference
├── prisma/                    ← schema + migrations (Milestone B)
├── src/
│   ├── app/                   ← Next App Router routes
│   ├── features/              ← per-feature folders (Milestone G)
│   ├── lib/                   ← shared infrastructure (db, auth, log, crypto, …)
│   └── test/                  ← Vitest setup + fixtures
├── package.json
└── …
```

See `docs/PHASE_0_PLAN.md` § 6 for the plug-and-play feature folder convention.

## License

Private. All rights reserved.
