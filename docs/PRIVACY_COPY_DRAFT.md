# How Ledger handles your data

**Shipped.** This copy now lives in two places in the app:

- `src/app/privacy/page.tsx` — the full page, public route at `/privacy`
- `src/app/onboarding/OnboardingForm.tsx` — the inline version above the Canvas token box

Edit those files to change what users see. This doc is the reference copy and the open-questions list.

---

## Your data explained

Ledger connects to your Canvas account so it can show your assignments and grades in one place.

**What it stores.** Your name, school, grad year, and, if you connect Canvas, your courses, grades, and assignments. It syncs those over so you don't have to open five tabs to see what's due. I don't ask for anything else, and I never will.

**Your Canvas token is encrypted as soon as it reaches the server.** It's encrypted (AES-256-GCM, feel free to google it) before it's ever written to disk, and even I can't read it back without your specific account context. Every time it's decrypted to talk to Canvas on your behalf, that action gets logged, so there's a permanent record of when your token was used and why. Every time that token gets touched, including by me, it leaves behind a record that Ledger itself has no ability to edit or erase.

**No teachers, no parents, no school admins.** Even if I wanted to, was bribed, or was forced by the school to toggle a switch, I still couldn't, because it doesn't exist. There's no login for faculty, no admin panel that shows student data, and no monitoring mode. If a school ever pressures me to add one, the answer is no. That kind of defeats the whole purpose of Ledger.

**No ads, and no, I don't sell your data.** Ledger is free right now. Later there'll be a paid tier with some extra study tools, and that's the only way it'll ever make money.

**You can delete everything whenever you want.** One button in Settings, and it's actually gone rather than deactivated: your account, your synced Canvas data, your posts, and everything tied to you. One thing survives, a single line saying an account was deleted on that date, with your identity stripped from it.

---

## Inline version (above the Canvas token box)

> Your token is encrypted the second it reaches the server. No teacher, parent, or admin can ever see it. [How it works →]

---

## Accuracy notes

Every claim on this page maps to something real in the code. If you change the code, check this list.

| Claim | Backed by |
| --- | --- |
| AES-256-GCM, encrypted before disk | `src/lib/crypto/encryption.ts` |
| Even I can't read it without your account context | AAD bound to `userId` in `src/features/canvas-sync/token.ts` |
| Every decrypt is logged | `getDecryptedToken()` calls `audit.log()` |
| Ledger can't edit or erase those records | `REVOKE UPDATE, DELETE ON "AuditLog" FROM app_user`, migration `20260527043210_rls` |
| No faculty/parent/admin login exists | No such role in schema; `Enrollment` has no role enum |
| Delete removes everything, one line survives | `src/lib/user/deleteUserCompletely.ts`, `actorUserId` → SET NULL |

The audit claim is deliberately scoped to what **Ledger** can do, not what you personally can do. You own the database, so you could delete audit rows by hand. Claiming otherwise would be an overclaim.

## Still open

- **Canvas access history panel.** The page says there's a permanent record. Students can't see that record. Building a list of decrypt events on the You page would make the claim checkable instead of just stated. The data is already there.
- **"You don't have to take my word for it."** The public-code paragraph is cut until the repo is actually public and LICENSE + SECURITY.md exist.
- **Saying you're a student.** The page works around the actual objection. Naming it directly might be stronger.
- **Onboarding and login are unstyled.** Both still use `border-gray-300`, `bg-black`, `text-gray-500` instead of the brand tokens the rest of the app got in G2. In dark mode that's a black button on a near-black background. These are the first two screens a new student sees.
