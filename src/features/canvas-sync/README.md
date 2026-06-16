# canvas-sync

Pulls a user's Canvas courses, sections, enrollments, and assignments into the
database. Phase 0 onboarding uses it: paste a Canvas token → encrypt → store →
sync → dashboard.

## Files

| File | Purpose |
| --- | --- |
| `canvas.ts` | Typed Canvas REST client. Link-header pagination; distinct `CanvasAuthError` (401) / `CanvasApiError` / `CanvasUnavailableError`. |
| `token.ts` | `saveToken` / `getDecryptedToken`. AES-256-GCM via the Milestone D module, format `v2:<base64url(iv‖tag‖ciphertext)>`, AAD-bound to `userId`. Every decryption is audited (Decision D1). |
| `sync.ts` | `syncUserCanvas(userId)`. Fetches from Canvas, upserts under `withSession` (RLS-enforced), one transaction per entity type. Bumps `User.lastSyncedAt` only on full success. |
| `*.test.ts` | Client (mocked fetch), token round-trip + audit, sync success/partial/error paths. |

## Conventions (per `docs/PHASE_0_PLAN.md` §6)

- Imports from `src/lib/*` only (crypto, db, audit, log, analytics). No cross-feature imports.
- Canvas base URL comes from `School.canvasUrl` — never hardcoded.
- Events use the central taxonomy `EVENTS.canvas.*`.

## Notes

- Token saving/sync is wired into onboarding (`src/app/onboarding`). Sync runs
  **inline** in the server action (no background jobs in Phase 0).
- Partial failure is tolerated: a later entity type failing leaves earlier types
  committed; the user lands on the dashboard with a `?sync=<status>` banner.
- There is no in-app "re-sync" button yet — that arrives with the real dashboard
  in Milestone G.
