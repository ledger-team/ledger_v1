// Invite gate for Canvas token paste (Phase 0). While Canvas OAuth is pending,
// token-paste is restricted to an allowlist.
//
//   INVITE_ONLY=true                 → only allowlisted emails may paste
//   INVITE_ONLY unset / not "true"   → everyone may paste
//   INVITE_ALLOWLIST=a@x.com,b@y.com → comma-separated, case-insensitive
//
// Non-allowlisted users are NOT shown an error — they see a "coming soon"
// panel at the token-paste step (see the onboarding flow).

export function canPasteCanvasToken(email: string | null | undefined): boolean {
  if (process.env.INVITE_ONLY !== 'true') return true
  if (!email) return false
  const allow = (process.env.INVITE_ALLOWLIST ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return allow.includes(email.trim().toLowerCase())
}
