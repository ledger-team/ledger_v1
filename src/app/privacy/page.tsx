import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'How Ledger handles your data',
  description: 'What Ledger stores, how your Canvas token is protected, and who can see it.',
}

// Public page (see the allowlist in src/middleware.ts). Linked from the Canvas
// token step in onboarding and from the You page.
//
// Plain language on purpose. The real architecture lives in docs/FOUNDATION.md,
// and every claim here maps to code — see docs/PRIVACY_COPY_DRAFT.md for the
// claim-to-source table. If you change the crypto or audit behavior, re-check it.

const SECTIONS = [
  {
    heading: 'What it stores',
    body: `Your name, school, grad year, and, if you connect Canvas, your courses, grades, and assignments. It syncs those over so you don't have to open five tabs to see what's due. I don't ask for anything else, and I never will.`,
  },
  {
    heading: 'Your Canvas token is encrypted as soon as it reaches the server',
    body: `It's encrypted (AES-256-GCM, feel free to google it) before it's ever written to disk, and even I can't read it back without your specific account context. Every time it's decrypted to talk to Canvas on your behalf, that action gets logged, so there's a permanent record of when your token was used and why. Every time that token gets touched, including by me, it leaves behind a record that Ledger itself has no ability to edit or erase.`,
  },
  {
    heading: 'No teachers, no parents, no school admins',
    body: `Even if I wanted to, was bribed, or was forced by the school to toggle a switch, I still couldn't, because it doesn't exist. There's no login for faculty, no admin panel that shows student data, and no monitoring mode. If a school ever pressures me to add one, the answer is no. That kind of defeats the whole purpose of Ledger.`,
  },
  {
    heading: `No ads, and no, I don't sell your data`,
    body: `Ledger is free right now. Later there'll be a paid tier with some extra study tools, and that's the only way it'll ever make money.`,
  },
  {
    heading: 'You can delete everything whenever you want',
    body: `One button in Settings, and it's actually gone rather than deactivated: your account, your synced Canvas data, your posts, and everything tied to you. One thing survives, a single line saying an account was deleted on that date, with your identity stripped from it.`,
  },
]

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-14 sm:py-20">
      <Link href="/" className="inline-flex items-center gap-2 no-underline">
        <span
          aria-hidden
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-sm font-bold text-black"
        >
          L
        </span>
        <span className="text-sm font-semibold tracking-tight text-accent">Ledger</span>
      </Link>

      <h1 className="mt-8 text-3xl font-semibold tracking-tight sm:text-4xl">
        How Ledger handles your data
      </h1>
      <p className="mt-3 text-base leading-relaxed text-muted">
        Ledger connects to your Canvas account so it can show your assignments and grades in one
        place. Here is everything it touches, and everything it can&apos;t.
      </p>

      <div className="mt-10 flex flex-col gap-4">
        {SECTIONS.map((section) => (
          <section
            key={section.heading}
            className="rounded-xl border border-foreground/10 bg-surface p-5 sm:p-6"
          >
            <h2 className="flex items-start gap-2.5 text-base font-semibold tracking-tight">
              <span
                aria-hidden
                className="mt-[0.4rem] h-1.5 w-1.5 shrink-0 rounded-[2px] bg-accent"
              />
              {section.heading}
            </h2>
            <p className="mt-2 pl-[1.0rem] text-sm leading-relaxed text-foreground/75 sm:text-base">
              {section.body}
            </p>
          </section>
        ))}
      </div>

      <div className="mt-10 border-t border-foreground/10 pt-6">
        <p className="text-sm leading-relaxed text-muted">
          Built by one student at Dripping Springs. If something here is unclear or you think
          it&apos;s wrong, say so and I&apos;ll fix it.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block text-sm font-medium text-accent hover:underline"
        >
          Back to Ledger
        </Link>
      </div>
    </main>
  )
}
