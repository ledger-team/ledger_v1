# Production deploy runbook (Milestone J)

Step-by-step for cutting Ledger over to production. These are **dashboard/DNS
actions** — none of it lives in the repo. Work top to bottom.

> **Domain:** `myledger.tech` (purchased). Until it is pointed at Vercel and
> verified in Resend, magic-link email only delivers to the Resend account
> owner's address (you), because `onboarding@resend.dev` is a shared domain.
> **No other student can sign in until § 3 and § 7 are done.** That is the only
> thing gating a second user — everything else already works.

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
- **Before inviting students:** Resend → Domains → add `myledger.tech` → add the shown
  **SPF / DKIM / DMARC** DNS records at the registrar → wait for "Verified" →
  set `RESEND_FROM_EMAIL=login@myledger.tech`.

### Deliverability (matters more on a new `.tech`)

Every Ledger login is an email. If it lands in spam, the student sees nothing and
silently doesn't come back — the worst failure mode, because nobody reports it.
A brand-new domain on a non-`.com` TLD starts with no sending reputation, so:

1. **Set all three DNS records**, not just the two Resend requires to flip
   "Verified". DMARC is the one people skip. Start at `p=none`:
   `_dmarc.myledger.tech  TXT  "v=DMARC1; p=none; rua=mailto:<your email>"`
2. **Warm it up.** Send to yourself and 2–3 friends first, over a few days,
   before any wider invite. A cold domain blasting 30 signups in an hour is
   exactly what spam filters are built to catch.
3. **Check where it actually lands.** Send a magic link to a fresh Gmail account
   you own and confirm it hits the inbox, not Promotions or Spam. Gmail is where
   effectively all of your users are.
4. If deliverability stays bad, sending auth mail from a `.com` you own (while
   the site stays on `myledger.tech`) is the escape hatch. `NEXTAUTH_URL` and
   `RESEND_FROM_EMAIL` are independent — the sending domain does not have to
   match the site domain.

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
| `NEXTAUTH_URL` | `https://<vercel-url>` now → `https://myledger.tech` after § 7 |
| `NEXTAUTH_SECRET` | existing secret (`openssl rand -base64 32` if rotating) |
| `ENCRYPTION_KEY` | **the exact existing key** — rotating it makes stored CanvasToken ciphertext undecryptable |
| `RESEND_API_KEY` | Resend dashboard |
| `RESEND_FROM_EMAIL` | `onboarding@resend.dev` now → `login@myledger.tech` after verify |
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

## 7. Point `myledger.tech` at Vercel

1. Vercel → project → Settings → Domains → add `myledger.tech` → set the registrar
   DNS records Vercel shows (usually an `A` record for the apex and a `CNAME` for
   `www`). These are **separate** from the Resend records in § 3; both sets coexist.
2. Verify the domain in **Resend** (§ 3) and set `RESEND_FROM_EMAIL=login@myledger.tech`.
3. Update `NEXTAUTH_URL=https://myledger.tech` in Vercel → **redeploy**.
   NextAuth builds magic-link callbacks from this value, so a stale one produces
   links that point at the old host and fail after the click.
4. Point the Better Stack monitor at `https://myledger.tech/api/health`.

No code changes — the domain is entirely env-driven.

## 8. Branch protection

Already applied in Milestone I (required checks `quality`/`test`/`build`, no direct
pushes, enforce admins). Nothing to do here.

---

After deploy, run **`SMOKE_TEST.md`**.
