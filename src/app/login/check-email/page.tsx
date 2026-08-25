import Link from 'next/link'
import { BrandMark } from '@/components/BrandMark'

// Shown right after a magic link is requested. The spam panel is the point of
// this screen: myledger.tech is a new sending domain with no reputation yet, so
// Gmail files the first message under Spam or Promotions more often than not.
// Telling people that up front costs nothing and saves the signup. Asking them
// to mark it "not spam" also genuinely improves deliverability for the next
// person, since that is one of the signals Gmail weighs.

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string }>
}) {
  const { to } = await searchParams

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6 py-12">
      <Link href="/" className="mb-10 self-start">
        <BrandMark size="sm" />
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        {to ? (
          <>
            We sent a sign-in link to <span className="text-foreground">{to}</span>. Click it and
            you&apos;re in. It expires in 10 minutes.
          </>
        ) : (
          <>We sent you a sign-in link. Click it and you&apos;re in. It expires in 10 minutes.</>
        )}
      </p>

      <div className="mt-6 rounded-xl border border-warn/30 bg-warn/5 p-4">
        <h2 className="text-sm font-semibold">Not there? Check your spam folder.</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-foreground/75">
          Ledger is new enough that Gmail doesn&apos;t recognize it yet, so the first email often
          lands in Spam or Promotions. If you find it there, hit <strong>Not spam</strong>. That
          actually helps, and it means the next person&apos;s link shows up in their inbox.
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-2 text-sm">
        <Link href="/login" className="text-accent hover:underline">
          Wrong address? Try again →
        </Link>
        <p className="text-xs text-muted">
          You can close this tab once you&apos;ve clicked the link.
        </p>
      </div>
    </main>
  )
}
