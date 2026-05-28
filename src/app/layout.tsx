import type { Metadata } from 'next'
import { PostHogProvider } from '@/lib/analytics/posthog.client'
import './globals.css'

export const metadata: Metadata = {
  title: 'Ledger',
  description: 'The operating system for high school life.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  )
}
