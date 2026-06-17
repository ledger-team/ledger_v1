import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getDashboardData } from '@/features/dashboard/queries'
import { pickGreeting } from '@/features/dashboard/greeting'
import { HomeView } from '@/features/dashboard/components/HomeView'

const SYNC_BANNERS: Record<string, string> = {
  auth_error: 'Canvas rejected your token. Reconnect Canvas to sync your courses.',
  unavailable: "Couldn't reach Canvas — your courses aren't synced yet. Try again later.",
  partial: 'Canvas synced with some gaps. Some data may be missing; try again later.',
  no_token: 'Connect Canvas to see your courses.',
  error: 'Canvas sync didn’t complete.',
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ sync?: string }>
}) {
  const session = await getServerSession()
  if (!session) redirect('/login')

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
    <HomeView
      greeting={pickGreeting(firstName)}
      schoolName={school?.name ?? null}
      data={data}
      syncBanner={sync ? (SYNC_BANNERS[sync] ?? null) : null}
    />
  )
}
