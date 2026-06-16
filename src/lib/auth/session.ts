// Session resolver — real NextAuth internals as of Milestone E.
//
// This file deliberately keeps the same surface it had as a placeholder in
// Milestone D: `getServerSession(): Promise<AppSession | null>` and
// `requireUser()`. `src/lib/api/withApi.ts` depends only on this surface
// (it reads `session.user.id`), so swapping the internals here required NO
// change to withApi. AppSession has only GAINED fields (additive).

import { getServerSession as nextAuthGetServerSession } from 'next-auth'
import { authOptions } from './config'

export type AppSession = {
  user: {
    id: string
    email: string | null
    name: string | null
    schoolId?: string | null
    gradYear?: number | null
    onboarded: boolean
  }
}

export async function getServerSession(): Promise<AppSession | null> {
  const session = await nextAuthGetServerSession(authOptions)
  if (!session?.user?.id) return null
  return {
    user: {
      id: session.user.id,
      email: session.user.email ?? null,
      name: session.user.name ?? null,
      schoolId: session.user.schoolId ?? null,
      gradYear: session.user.gradYear ?? null,
      onboarded: session.user.onboarded ?? Boolean(session.user.schoolId),
    },
  }
}

export async function requireUser(): Promise<AppSession> {
  const session = await getServerSession()
  if (!session) throw new Error('Unauthorized')
  return session
}
