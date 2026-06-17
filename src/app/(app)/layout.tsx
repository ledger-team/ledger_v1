import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth/session'
import { AppNav } from '@/components/AppNav'
import { AppHeader } from '@/components/AppHeader'
import { MotionProvider } from '@/components/MotionProvider'
import { TabTransition } from '@/components/TabTransition'

// The app shell: persistent nav across /home /feed /study /you. Single guard for
// the whole group (auth + onboarding); pages re-read the session for their data.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession()
  if (!session) redirect('/login')
  if (!session.user.onboarded) redirect('/onboarding')

  return (
    <MotionProvider>
      <AppNav userName={session.user.name} />
      <div className="md:pl-56">
        <AppHeader userName={session.user.name} />
        <main className="mx-auto max-w-2xl px-4 pb-28 pt-3 md:pb-12 md:pt-8">
          <TabTransition>{children}</TabTransition>
        </main>
      </div>
    </MotionProvider>
  )
}
