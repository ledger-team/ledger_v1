import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from '@/lib/auth/session'
import { canPasteCanvasToken } from '@/lib/auth/inviteAllowlist'
import { prisma } from '@/lib/db/prisma'
import { BrandMark } from '@/components/BrandMark'
import { OnboardingForm } from './OnboardingForm'

export default async function OnboardingPage() {
  const session = await getServerSession()
  if (!session) redirect('/login')
  if (session.user.onboarded) redirect('/home')

  const schools = await prisma.school.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  // Build the grad-year options here rather than in the client component, so they
  // are guaranteed to match the range OnboardingSchema accepts in actions.ts
  // (nextYear - 1 .. nextYear + 6). A select that can only emit valid values beats
  // a free-text number input that can fail validation after the fact.
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
