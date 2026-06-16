# Observability Runbook

*Manual checks for the things automated tests can't reach: actual ingestion at Sentry, PostHog, and Better Stack. Run these once when a milestone touches observability, then again after each production deploy.*

*Last updated: 2026-05-28.*

---

## When to run this

- After Milestone C lands (initial verification).
- Whenever an observability env var is added or rotated.
- After every production deploy until automated smoke checks cover it (Milestone J+).
- If `audit.write.failed` appears in Sentry — confirm the audit table is actually receiving rows again.

---

## Pre-flight

1. `.env` is populated with at least `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_POSTHOG_KEY`, `POSTHOG_PROJECT_API_KEY`, `BETTER_STACK_SOURCE_TOKEN` (optional — placeholder transport works without it).
2. `pnpm install` — clean.
3. `pnpm db:seed` ran at some point — RLS test users exist.
4. Dev server running: `pnpm dev`.

---

## Layer 1 — Pino → Better Stack

**What we're verifying:** the logger emits structured JSON in dev (visible as NDJSON in the dev server terminal); when a Better Stack source is configured via a Vercel log drain, the same lines ship there automatically.

### Dev check

```bash
curl http://localhost:3000/api/smoke/logger
```

Expected:
- HTTP 200 JSON response: `{ "ok": true, "event": "smoke.logger.info" }`
- Terminal where `pnpm dev` is running shows three NDJSON lines containing `"event":"smoke.logger.info"`, `"event":"smoke.logger.warn"`, `"event":"smoke.logger.error"`.

For colorized output during dev, pipe the dev server through `pino-pretty`:
```bash
pnpm dev | npx pino-pretty --colorize --translateTime "HH:MM:ss.l" --ignore "pid,hostname"
```
(Pino's in-process worker transports break under Next 15's webpack bundling, so we emit raw JSON and pretty-print externally.)

### Better Stack ingestion check (prod, when log drain is set up)

Configured via Vercel → Settings → Log Drains → "Better Stack." No code change needed in this repo. Verification happens in Milestone J once a real prod deploy exists.

---

## Layer 2 — Sentry

**What we're verifying:** uncaught errors thrown by server routes appear in Sentry's Issues view within 60 seconds, with stack trace and request context.

### Steps

1. Open your browser to `http://localhost:3000/api/smoke/sentry`.
2. Expect a 500 page (the route intentionally throws).
3. Open Sentry → Issues. Sort by "Last Seen."
4. Within 60s, an issue titled `Error: smoke: sentry test (intentional ...)` appears.
5. Click into it. Verify:
   - Stack trace shows `src/app/api/smoke/sentry/route.ts` and the `throw new Error(...)` line.
     - Source-mapped to TypeScript? Probably not in Phase 0 (source map upload deferred to Milestone J). Reading compiled JS line numbers is acceptable.
   - Request context shows the URL and HTTP method.
   - Environment tag: `development`.

### Common failures

| Symptom | Likely cause |
| --- | --- |
| Issue never appears | `SENTRY_DSN` missing in `.env`, or your firewall is blocking sentry.io. |
| Issue appears but no stack | Source map upload is deferred. Look at the file/line in the compiled JS; matches the route file's structure. |
| 404 instead of 500 | You're hitting the route with `NODE_ENV=production` somehow — confirm `.env` and shell state. |

---

## Layer 3 — PostHog

**What we're verifying:** server-side events emitted via `captureServer()` arrive in PostHog within 60 seconds.

### Steps

1. `curl http://localhost:3000/api/smoke/posthog`
2. Expect `{ "ok": true, "event": "smoke.posthog.test" }`.
3. Open PostHog → Activity → Events. Filter for event name `smoke.posthog.test`.
4. Within 60s, an event appears with `distinct_id = smoke-user` and properties `{ now: <timestamp>, source: "api/_smoke/posthog" }`.

### Browser pageview check (Layer 3, client side)

1. Open `http://localhost:3000/` in browser.
2. PostHog → Activity → Events. Filter `$pageview`.
3. Within 60s, a `$pageview` event with the localhost URL.

### Common failures

| Symptom | Likely cause |
| --- | --- |
| Server event missing | `POSTHOG_PROJECT_API_KEY` is wrong, or `NEXT_PUBLIC_POSTHOG_HOST` points at the wrong region (US vs EU). |
| `$pageview` missing | `NEXT_PUBLIC_POSTHOG_KEY` missing, ad-blocker eating the request, or the PostHogProvider isn't mounted. |

---

## Layer 4 — AuditLog

**What we're verifying:** the audit helper writes rows, the append-only enforcement holds, and the RLS isolation test passes.

### Steps

1. `pnpm test src/lib/audit/audit.test.ts` — green.
2. `pnpm test src/lib/db/__tests__/rls.test.ts` — green.
3. (Optional) `pnpm db:studio` → open `AuditLog` table → confirm `audit.test.basic` and `audit.test.system` rows are present (from the audit tests — they're cleaned up in `afterAll` but you can catch them mid-run).

---

## Cross-layer check — `queryAll`

```bash
pnpm test src/lib/log/query.test.ts
```

Asserts the `audit` source returns rows and the `sentry`/`posthog`/`logs` sources throw `NotImplementedInPhase0` with a useful message.

---

## What good looks like, end-of-runbook

- ✅ Three log lines visible in terminal (dev) or Better Stack (prod) within 60s of hitting `/api/smoke/logger`.
- ✅ Sentry shows the thrown error within 60s of visiting `/api/smoke/sentry`.
- ✅ PostHog shows `smoke.posthog.test` event + `$pageview` within 60s.
- ✅ `pnpm test` shows the RLS test passing.
- ✅ No `audit.write.failed` events in Sentry over the last 24 hours.
