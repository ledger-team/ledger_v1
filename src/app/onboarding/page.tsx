import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from '@/lib/auth/session'
import { canPasteCanvasToken } from '@/lib/auth/inviteAllowlist'
import { prisma } from '@/lib/db/prisma'
import { BrandMark } from '@/components/BrandMark'
import { OnboardingForm } from './OnboardingForm'

// completeOnboarding runs saveToken + syncUserCanvas INLINE before redirecting,
// which is 15-40s against real Canvas. The Vercel default timeout kills that
// mid-sync and the student lands on a half-populated dashboard. Hobby caps at
// 10s regardless of this value — the sync cannot work there at all.
export const maxDuration = 300

export default async function OnboardingPage() {
  const session = await getServerSession()
  if (!session) redirect('/login')
  if (session.user.onboarded) redirect('/home')

  const schools = await prisma.school.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  // Built here rather than in the client component so the options are guaranteed
  // to match the range OnboardingSchema accepts in actions.ts (nextYear - 1 ..
  // nextYear + 6). A select that can only emit valid values beats a free-text
  // number input that fails validation after the fact.
  const nextYear = new Date().getFullYear() + 1
  const gradYears = Array.from({ length: 8 }, (_, i) => nextYear - 1 + i)

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <Link href="/" className="mb-10 self-start">
        <BrandMark size="sm" />
      </Link>
      <OnboardingForm
        schools={schools}
        gradYears={gradYears}
        canPasteToken={canPasteCanvasToken(session.user.email)}
        defaultName={session.user.name ?? ''}
      />
    </main>
  )
}
