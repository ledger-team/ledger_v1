import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { SignOutButton } from './SignOutButton'

// Placeholder dashboard. The real feature lands in Milestone G — but it shows
// real session data (name + school) and the live synced-course count so the
// auth → onboarding → Canvas-sync flow feels complete when verified locally.

const SYNC_BANNERS: Record<string, { text: string; tone: string }> = {
  ok: { text: 'Canvas synced.', tone: 'bg-green-50 text-green-800' },
  auth_error: {
    text: 'Canvas rejected your token. Reconnect Canvas to sync your courses.',
    tone: 'bg-red-50 text-red-800',
  },
  unavailable: {
    text: "Couldn't reach Canvas — your courses aren't synced yet. Try again later.",
    tone: 'bg-amber-50 text-amber-900',
  },
  partial: {
    text: 'Canvas synced with some gaps. Some data may be missing; try again later.',
    tone: 'bg-amber-50 text-amber-900',
  },
  no_token: { text: 'No Canvas token on file yet.', tone: 'bg-gray-50 text-gray-700' },
  error: { text: 'Canvas sync didn’t complete.', tone: 'bg-red-50 text-red-800' },
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ sync?: string }>
}) {
  const session = await getServerSession()
  if (!session) redirect('/login')
  if (!session.user.onboarded) redirect('/onboarding')

  const [school, courseCount] = await Promise.all([
    session.user.schoolId
      ? prisma.school.findUnique({
          where: { id: session.user.schoolId },
          select: { name: true },
        })
      : Promise.resolve(null),
    prisma.course.count({
      where: { sections: { some: { enrollments: { some: { userId: session.user.id } } } } },
    }),
  ])

  const firstName = (session.user.name ?? '').trim().split(/\s+/)[0] || session.user.email || 'there'
  const banner = SYNC_BANNERS[(await searchParams).sync ?? '']

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
      {banner && <div className={`rounded-md px-3 py-2 text-sm ${banner.tone}`}>{banner.text}</div>}
      <h1 className="text-2xl font-semibold">Welcome, {firstName}.</h1>
      <p className="text-gray-700">You&apos;re in at {school?.name ?? 'your school'}.</p>
      <p className="text-sm text-gray-600">
        {courseCount > 0
          ? `${courseCount} course${courseCount === 1 ? '' : 's'} synced from Canvas.`
          : 'No courses synced yet.'}
      </p>
      <p className="text-sm text-gray-400">Your full dashboard arrives in Milestone G.</p>
      <div>
        <SignOutButton />
      </div>
    </main>
  )
}
