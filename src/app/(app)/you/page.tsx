import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth/session'
import { withSession } from '@/lib/db/withSession'
import { YouView } from '@/components/YouView'

export default async function YouPage() {
  const session = await getServerSession()
  if (!session) redirect('/login')

  // All reads via withSession (RLS): own CanvasToken + own lastSyncedAt, plus the
  // school name (school_select allows any authenticated user).
  const info = await withSession(
    { user_id: session.user.id, school_id: session.user.schoolId ?? null },
    async (tx) => {
      const token = await tx.canvasToken.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      })
      const user = await tx.user.findUnique({
        where: { id: session.user.id },
        select: { lastSyncedAt: true },
      })
      const school = session.user.schoolId
        ? await tx.school.findUnique({
            where: { id: session.user.schoolId },
            select: { name: true },
          })
        : null
      return {
        connected: Boolean(token),
        lastSyncedAt: user?.lastSyncedAt ?? null,
        schoolName: school?.name ?? null,
      }
    },
  )

  return (
    <YouView
      name={session.user.name}
      email={session.user.email}
      schoolName={info.schoolName}
      canvasConnected={info.connected}
      lastSyncedAt={info.lastSyncedAt}
    />
  )
}
