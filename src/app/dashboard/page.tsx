import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getDashboardData } from '@/features/dashboard/queries'
import { DashboardView } from '@/features/dashboard/components/DashboardView'

const SYNC_BANNERS: Record<string, string> = {
  auth_error: 'Canvas rejected your token. Reconnect Canvas to sync your courses.',
  unavailable: "Couldn't reach Canvas — your courses aren't synced yet. Try again later.",
  partial: 'Canvas synced with some gaps. Some data may be missing; try again later.',
  no_token: 'Connect Canvas to see your courses.',
  error: 'Canvas sync didn’t complete.',
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ sync?: string }>
}) {
  const session = await getServerSession()
  if (!session) redirect('/login')
  if (!session.user.onboarded) redirect('/onboarding')

  const [school, data] = await Promise.all([
    session.user.schoolId
      ? prisma.school.findUnique({ where: { id: session.user.schoolId }, select: { name: true } })
      : Promise.resolve(null),
    getDashboardData(session),
  ])

  const firstName =
    (session.user.name ?? '').trim().split(/\s+/)[0] || session.user.email || 'there'
  const sync = (await searchParams).sync

  return (
    <DashboardView
      name={firstName}
      schoolName={school?.name ?? null}
      data={data}
      syncBanner={sync ? (SYNC_BANNERS[sync] ?? null) : null}
    />
  )
}
