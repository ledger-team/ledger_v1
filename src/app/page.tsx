import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth/session'

// Root bounce. `/` is public in middleware (which can only do a cookie-presence
// check on the Edge runtime), so this Node server component does the real
// session check. Not-yet-onboarded users land on /home and the (app) layout
// forwards them to /onboarding.
export default async function RootPage() {
  const session = await getServerSession()
  redirect(session ? '/home' : '/login')
}
