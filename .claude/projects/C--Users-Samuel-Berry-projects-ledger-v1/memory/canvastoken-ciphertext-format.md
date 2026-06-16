---
name: canvastoken-ciphertext-format
description: CanvasToken.encryptedToken must use the D crypto module's base64url format, NOT the hex format in the schema comment
metadata:
  type: project
---

`CanvasToken.encryptedToken` must store the format produced by `src/lib/crypto/encryption.ts`: `v2:<base64url(iv‖tag‖ciphertext)>` — a single base64url blob after the `v2:` prefix.

The schema comment on `CanvasToken.encryptedToken` in `prisma/schema.prisma` is **wrong** — it says `v2:<iv hex>:<tag hex>:<ciphertext hex>` (colon-delimited hex). That hex format was never implemented. The Milestone D module is the source of truth.

**Why:** confirmed by Sam in Milestone E planning; the D module (shipped, tested) uses base64url, and F's `saveToken`/`getDecryptedToken` must match it.

**How to apply:** when building Milestone F (Canvas token save/sync), write/read tokens via the D module's `encrypt`/`decrypt` (base64url), add a code comment in F noting the schema comment is stale, and ideally fix the schema comment. Token saving is intentionally NOT in Milestone E (E ships only the gated paste UI stub). Related: [[milestone-d-security]] if present.
