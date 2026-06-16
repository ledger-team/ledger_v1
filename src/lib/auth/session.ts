// Session resolver — PLACEHOLDER for Milestone D.
//
// There is no authentication system until Milestone E (NextAuth + Resend magic
// link). `withApi` depends only on the shape below, so when E lands it replaces
// the *internals* of `getServerSession()` with the real NextAuth lookup and the
// wrapper keeps working unchanged.
//
// Until then `getServerSession()` returns null: every non-`public` route is
// effectively locked (401), which is the correct default for a half-built app.

export type AppSession = {
  user: {
    id: string
    schoolId?: string | null
  }
}

export async function getServerSession(): Promise<AppSession | null> {
  return null
}

export async function requireUser(): Promise<AppSession> {
  const session = await getServerSession()
  if (!session) throw new Error('Unauthorized')
  return session
}
