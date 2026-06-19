# Production smoke test (Milestone J)

Run after every production deploy. `<URL>` = the live host (Vercel URL or domain).
Founder-runnable; ~10 minutes. Every box must pass.

## Auth → onboarding → dashboard
- [ ] **Health:** `GET <URL>/api/health` → `200 {"status":"ok","db":"ok"}`.
- [ ] **Magic link sends:** open `<URL>/login` (incognito) → enter your email → "check your inbox" screen → email arrives < 60s.
      - On the Vercel URL this only works for your **Resend account email** (see DEPLOY § Resend).
- [ ] **Magic link works:** click the link → lands on `/onboarding` (or `/home` if already onboarded). The link host matches `<URL>` (not localhost — confirms `NEXTAUTH_URL`).
- [ ] **Onboarding:** name + Dripping Springs + grad year → Continue → paste your real Canvas token → Finish.
- [ ] **Sync loader:** the animated "ledger" loader shows during the sync wait (not a frozen button / blank).
- [ ] **Dashboard:** redirected to `/home` showing **real DSISD courses**, grades color-coded, upcoming assignments under "Next 7 days" / "Coming up". No `?sync=` error banner.

## Observability
- [ ] **Sentry + source maps:** trigger a server error in prod (a one-off, or temporarily hit a throwing route) → appears in Sentry **with the stack mapped to original `.ts`** (proves source-map upload worked).
- [ ] **PostHog:** load `/home` → a pageview appears in PostHog within ~60s.
- [ ] **Pino → Better Stack:** a magic-link login produces an `auth.session.created` log line in Better Stack within ~60s (user id, not email).
- [ ] **Audit:** Supabase SQL editor → `SELECT action, "actorUserId" FROM "AuditLog" ORDER BY "createdAt" DESC LIMIT 10` → see `onboarding.completed`, `canvas.token.encrypted`, `canvas.token.decrypted`.

## Infra
- [ ] **Uptime:** Better Stack monitor on `<URL>/api/health` is green.
- [ ] **Branch protection:** a direct push to `main` is rejected; CI gates PRs.
- [ ] **Supabase Pro:** project shows Pro + PITR enabled; not paused.

## Brand
- [ ] **Favicon** shows the lime mark in the browser tab.
- [ ] **OG image:** paste `<URL>` into a link preview (e.g. a Slack/iMessage to yourself) → the centered mark on dark background renders.

When all boxes pass, Phase 0 is **done in production**.
