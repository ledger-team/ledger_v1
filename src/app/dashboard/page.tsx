import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { SignOutButton } from './SignOutButton'

// Placeholder dashboard. The real feature lands in Milestone G — but it shows
// real session data (name + school) so the auth → onboarding → dashboard flow
// feels complete when verified locally.
export default async function DashboardPage() {
  const session = await getServerSession()
  if (!session) redirect('/login')
  if (!session.user.onboarded) redirect('/onboarding')

  const school = session.user.schoolId
    ? await prisma.school.findUnique({
        where: { id: session.user.schoolId },
        select: { name: true },
      })
    : null

  const firstName = (session.user.name ?? '').trim().split(/\s+/)[0] || session.user.email || 'there'

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Welcome, {firstName}.</h1>
      <p className="text-gray-700">You&apos;re in at {school?.name ?? 'your school'}.</p>
      <p className="text-sm text-gray-400">Your full dashboard arrives in Milestone G.</p>
      <div>
        <SignOutButton />
      </div>
    </main>
  )
}
