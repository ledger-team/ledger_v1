# Production deploy runbook (Milestone J)

Step-by-step for cutting Ledger over to production. These are **dashboard/DNS
actions** — none of it lives in the repo. Work top to bottom.

> **Domain status:** none purchased yet. We launch on the Vercel-provided URL
> (e.g. `ledger-v1.vercel.app`) for the founder's own end-to-end test.
> **A real domain is required before inviting other students** — Resend cannot
> verify a `*.vercel.app` domain, so on the Vercel URL magic-link email only
> delivers to the Resend account owner's address (you). See § Resend and
> § Domain swap.

---

## 1. Supabase → Pro (do first; stops free-tier pausing)

1. Supabase dashboard → project → Settings → Billing → upgrade to **Pro**.
2. Settings → Database → **Point-in-Time Recovery** → enable.
3. **Connection strings:** upgrading does **not** change them (same project ref/host).
   Copy `DATABASE_URL` (Transaction pooler, `?pgbouncer=true&connection_limit=1`)
   and `DIRECT_URL` (Session/direct) for the Vercel env below. If they ever change,
   update Vercel and redeploy.

## 2. Sentry auth token (for source-map upload at build)

Source-map upload is enabled in `next.config.ts` and fires **only** when these are
present at build time:
1. Sentry → Settings → Auth Tokens → create a token with `project:releases` +
   `org:read` (+ `project:write`) scope → `SENTRY_AUTH_TOKEN`.
2. `SENTRY_ORG` = `ledger-4a`, `SENTRY_PROJECT` = `javascript-nextjs`.

## 3. Resend sending domain (gates emailing real students)

- **On the Vercel URL (now):** leave `RESEND_FROM_EMAIL=onboarding@resend.dev`.
  Email only reaches **your own** Resend account address. Enough for your solo smoke test.
- **Before inviting students:** Resend → Domains → add your domain → add the shown
  **SPF / DKIM / DMARC** DNS records at your registrar → wait for "Verified" →
  set `RESEND_FROM_EMAIL=login@<domain>`.

## 4. Vercel project

1. Vercel → Add New → Project → import **`ledger-team/ledger_v1`**. Framework
   auto-detects **Next.js**. Build command stays `pnpm build`; no overrides.
2. Add **all** Environment Variables (Production scope) — see § Env vars.
3. Deploy. The build is CI-verified and env-free except the values below; it will succeed.
4. Note the assigned URL (e.g. `ledger-v1.vercel.app`) → use it for `NEXTAUTH_URL`.

## 5. Env vars (Vercel → Settings → Environment Variables, Production)

| Var | Value / source |
| --- | --- |
| `DATABASE_URL` | Supabase Transaction pooler string |
| `DIRECT_URL` | Supabase Session/direct string |
| `NEXTAUTH_URL` | `https://<vercel-url>` (then the real domain after swap) |
| `NEXTAUTH_SECRET` | existing secret (`openssl rand -base64 32` if rotating) |
| `ENCRYPTION_KEY` | **the exact existing key** — rotating it makes stored CanvasToken ciphertext undecryptable |
| `RESEND_API_KEY` | Resend dashboard |
| `RESEND_FROM_EMAIL` | `onboarding@resend.dev` now → `login@<domain>` after verify |
| `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` / `POSTHOG_PROJECT_API_KEY` | PostHog |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Sentry project DSN |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | § 2 (build-time source maps) |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Upstash console |
| `INVITE_ONLY` | `true` |
| `INVITE_ALLOWLIST` | comma-separated allowlisted emails |
| `BETTER_STACK_SOURCE_TOKEN` | Better Stack source |

`NODE_ENV` is set to `production` by Vercel automatically.

## 6. Better Stack uptime monitor

Better Stack → Monitors → new HTTP monitor → `https://<domain>/api/health`,
1-minute interval, expect `200`, alert → your email. `/api/health` is public and
does a live `SELECT 1`, so a green check means app **and** DB are up. (Do **not**
monitor `/home` — it 307-redirects unauthenticated requests.)

## 7. Domain swap (when a real domain is bought)

1. Vercel → project → Settings → Domains → add the domain → set the registrar DNS
   records Vercel shows.
2. Verify the domain in **Resend** (§ 3) and set `RESEND_FROM_EMAIL=login@<domain>`.
3. Update `NEXTAUTH_URL=https://<domain>` in Vercel → redeploy.
4. Point the Better Stack monitor at the new host.

No code changes — the domain is entirely env-driven.

## 8. Branch protection

Already applied in Milestone I (required checks `quality`/`test`/`build`, no direct
pushes, enforce admins). Nothing to do here.

---

After deploy, run **`SMOKE_TEST.md`**.
