// NextAuth v4 configuration — magic-link auth via Resend, database sessions.
//
// - strategy 'database': sessions live in the Session table (NOT JWT), so we can
//   revoke server-side and the session callback gets the full user row for free.
// - Resend is an HTTP API (not SMTP), so EmailProvider uses a custom
//   sendVerificationRequest instead of `server`.
// - The session callback surfaces id/schoolId/gradYear/onboarded onto
//   session.user so downstream code reads them without an extra DB query.
// - events.* write the audit trail (taxonomy in src/lib/analytics/events.ts).

import type { NextAuthOptions } from 'next-auth'
import EmailProvider from 'next-auth/providers/email'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { Resend } from 'resend'
import { prisma } from '@/lib/db/prisma'
import { audit } from '@/lib/audit/audit'
import { logger } from '@/lib/log/logger'
import { EVENTS } from '@/lib/analytics/events'

const FROM = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'

// Construct Resend lazily, NOT at module load: the Resend ctor throws on a
// missing key, and this module is imported (via session.ts → getServerSession)
// by every authed route, so a top-level `new Resend()` breaks `next build` when
// RESEND_API_KEY isn't present at build time. Deferring to send time keeps the
// build env-free while behavior at runtime is unchanged.

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'database', maxAge: 30 * 24 * 60 * 60 }, // 30 days
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/login',
    verifyRequest: '/login/check-email',
    error: '/login',
  },
  providers: [
    EmailProvider({
      from: FROM,
      maxAge: 10 * 60, // magic links expire in 10 minutes
      async sendVerificationRequest({ identifier, url }) {
        const resend = new Resend(process.env.RESEND_API_KEY)
        await resend.emails.send({
          from: FROM,
          to: identifier,
          subject: 'Sign in to Ledger',
          text: `Sign in to Ledger:\n${url}\n\nThis link expires in 10 minutes. If you didn't request it, ignore this email.`,
          html: `<p>Click to sign in to Ledger:</p>
<p><a href="${url}">Sign in to Ledger</a></p>
<p style="color:#666;font-size:13px">This link expires in 10 minutes. If you didn't request it, you can ignore this email.</p>`,
        })
      },
    }),
  ],
  callbacks: {
    // Database strategy: `user` is the adapter row (full Prisma User). Map the
    // app-specific fields onto session.user. onboarded ⇔ schoolId is set.
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id
        session.user.schoolId = user.schoolId ?? null
        session.user.gradYear = user.gradYear ?? null
        session.user.onboarded = Boolean(user.schoolId)
      }
      return session
    },
  },
  events: {
    async signIn({ user }) {
      await audit.log({ action: EVENTS.auth.session_created, actorUserId: user.id })
    },
    async signOut(message) {
      // Database strategy: `message.session` is the adapter session row, which
      // carries `userId` at runtime even though the public type doesn't expose it.
      const userId =
        'session' in message && message.session && 'userId' in message.session
          ? ((message.session as { userId?: string }).userId ?? null)
          : null
      await audit.log({ action: EVENTS.auth.session_revoked, actorUserId: userId })
    },
    async createUser({ user }) {
      logger.info({ event: EVENTS.auth.signin_requested, userId: user.id }, 'new user created')
    },
  },
}
