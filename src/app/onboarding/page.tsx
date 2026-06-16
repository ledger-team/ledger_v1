import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth/session'
import { canPasteCanvasToken } from '@/lib/auth/inviteAllowlist'
import { prisma } from '@/lib/db/prisma'
import { OnboardingForm } from './OnboardingForm'

export default async function OnboardingPage() {
  const session = await getServerSession()
  if (!session) redirect('/login')
  if (session.user.onboarded) redirect('/dashboard')

  const schools = await prisma.school.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome to Ledger</h1>
        <p className="mt-1 text-sm text-gray-500">A couple of quick things to get you set up.</p>
      </div>
      <OnboardingForm
        schools={schools}
        canPasteToken={canPasteCanvasToken(session.user.email)}
        defaultName={session.user.name ?? ''}
      />
    </main>
  )
}
