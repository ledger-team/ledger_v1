import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth/session'
import { BrandMark } from '@/components/BrandMark'
import { ThemeToggle } from '@/components/ThemeToggle'

// The front door. `/` is public in middleware (Edge can only do a cookie-presence
// check), so this Node server component does the real session check: signed-in
// users bounce to /home, everyone else gets the landing page.
//
// Deliberately server-rendered with no motion library. It is the first paint a
// new student ever sees, often on a phone on school wifi, so it ships no client
// JS beyond the theme toggle.

const FEATURES = [
  {
    title: 'Everything due, in one place',
    body: 'Ledger syncs straight from Canvas. Due in the next day shows up red, due this week shows up amber. No clicking through six course pages to find out what you missed.',
  },
  {
    title: 'Grades you can actually read',
    body: 'Every class, current score, color-coded. Open the app, know where you stand, close the app.',
  },
  {
    title: 'Nobody is watching',
    body: 'There is no teacher login. No admin panel. No parent view. Not as a setting that happens to be off, but as something that was never built and never will be.',
  },
]

export default async function LandingPage() {
  const session = await getServerSession()
  if (session) redirect('/home')

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <BrandMark size="sm" />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link
            href="/login"
            className="flex h-11 items-center rounded-lg px-4 text-sm font-medium hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6">
        <section className="py-16 sm:py-24">
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
            High school, <span className="text-accent">online</span>.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
            Every assignment and every grade from Canvas, in one place that does not look like it
            was designed in 2009. Built by a student at Dripping Springs, for students.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/login"
              className="flex h-12 items-center justify-center rounded-lg bg-accent px-6 text-sm font-semibold text-black transition-transform hover:brightness-110 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Get started
            </Link>
            <Link
              href="/login"
              className="flex h-12 items-center justify-center rounded-lg border border-foreground/15 px-6 text-sm font-medium hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              I already have an account
            </Link>
          </div>

          <p className="mt-4 text-xs text-muted">
            Free. No password to remember, we email you a link.
          </p>
        </section>

        <section className="grid gap-4 pb-16 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-foreground/10 bg-surface p-5 sm:p-6"
            >
              <div aria-hidden className="mb-3 h-1.5 w-6 rounded-full bg-accent" />
              <h2 className="text-base font-semibold tracking-tight">{f.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-foreground/75">{f.body}</p>
            </div>
          ))}
        </section>

        <section className="rounded-xl border border-accent/25 bg-accent/5 p-6 sm:p-8">
          <h2 className="text-lg font-semibold tracking-tight">
            &quot;I don&apos;t want some student having my data.&quot;
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground/75">
            Fair. So here is the whole answer: your Canvas token is encrypted before it is ever
            written to disk, every single use of it is logged, and you can delete everything with
            one button. Nothing on that page is a promise you have to take on faith.
          </p>
          <Link
            href="/privacy"
            className="mt-4 inline-block text-sm font-medium text-accent hover:underline"
          >
            Read exactly how it works →
          </Link>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="flex flex-col gap-3 border-t border-foreground/10 pt-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>Built by one student at Dripping Springs.</p>
          <Link href="/privacy" className="hover:text-foreground hover:underline">
            How your data is handled
          </Link>
        </div>
      </footer>
    </div>
  )
}
