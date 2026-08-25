'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { LedgerLoader } from '@/components/LedgerLoader'
import { completeOnboarding, type OnboardingState } from './actions'

type School = { id: string; name: string }

const FIELD =
  'h-12 rounded-lg border border-foreground/15 bg-surface px-3.5 text-sm outline-none placeholder:text-muted focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent'

export function OnboardingForm({
  schools,
  gradYears,
  canPasteToken,
  defaultName,
}: {
  schools: School[]
  gradYears: number[]
  canPasteToken: boolean
  defaultName: string
}) {
  const [step, setStep] = useState<1 | 2>(1)
  const [state, formAction, pending] = useActionState<OnboardingState, FormData>(
    completeOnboarding,
    {},
  )

  // Step 1 fields are controlled so "Continue" can gate on them. Without that
  // gate a user could advance with the fields empty, and because step 1 is then
  // hidden via CSS the browser cannot focus its `required` inputs on submit —
  // the form would silently refuse to submit with a console error.
  const [name, setName] = useState(defaultName)
  const [schoolId, setSchoolId] = useState('')
  const [gradYear, setGradYear] = useState('')
  const step1Complete = name.trim() !== '' && schoolId !== '' && gradYear !== ''

  // completeOnboarding runs saveToken + syncUserCanvas inline (15-40s) before it
  // redirects, so `pending` IS the sync wait. Show branded motion instead of a
  // frozen button.
  if (pending) return <LedgerLoader label="Syncing your courses…" />

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium tracking-wide text-accent uppercase">
          Step {step} of 2
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">
          {step === 1 ? 'Welcome to Ledger' : 'Connect Canvas'}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {step === 1
            ? 'Two quick questions, then you can pull in your classes.'
            : 'This is what fills your dashboard with real assignments and grades.'}
        </p>
      </div>

      <div aria-hidden className="flex gap-1.5">
        <span className="h-1 flex-1 rounded-full bg-accent" />
        <span className={`h-1 flex-1 rounded-full ${step === 2 ? 'bg-accent' : 'bg-foreground/15'}`} />
      </div>

      {/* Both steps stay mounted (step 2 hides step 1 with CSS) so every field is
          present in the FormData when the final submit fires. */}
      <form action={formAction} className="flex flex-col gap-5">
        <section className={step === 1 ? 'flex flex-col gap-4' : 'hidden'}>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-sm font-medium">
              Your name
            </label>
            <input
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              placeholder="Sam Berry"
              className={FIELD}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="schoolId" className="text-sm font-medium">
              High school
            </label>
            <select
              id="schoolId"
              name="schoolId"
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              required
              className={FIELD}
            >
              <option value="" disabled>
                Select your school…
              </option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted">
              Only Dripping Springs for now. More schools are coming.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="gradYear" className="text-sm font-medium">
              Graduation year
            </label>
            <select
              id="gradYear"
              name="gradYear"
              value={gradYear}
              onChange={(e) => setGradYear(e.target.value)}
              required
              className={FIELD}
            >
              <option value="" disabled>
                Select a year…
              </option>
              {gradYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setStep(2)}
            disabled={!step1Complete}
            className="flex h-12 items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-black transition-transform hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Continue
          </button>
        </section>

        <section className={step === 2 ? 'flex flex-col gap-4' : 'hidden'}>
          {canPasteToken ? (
            <>
              {/* The token step is where people hesitate. Answer the question they
                  are actually asking, right here, before they have to ask it.
                  Opens in a new tab so the half-filled form is not lost. */}
              <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
                <p className="text-sm leading-relaxed">
                  Your token is encrypted the second it reaches the server. No teacher, parent, or
                  admin can ever see it.
                </p>
                <Link
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-sm font-medium text-accent hover:underline"
                >
                  How it works →
                </Link>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="canvasToken" className="text-sm font-medium">
                  Canvas access token
                </label>
                <textarea
                  id="canvasToken"
                  name="canvasToken"
                  rows={3}
                  placeholder="Paste it here"
                  className="rounded-lg border border-foreground/15 bg-surface px-3.5 py-3 font-mono text-xs outline-none placeholder:font-sans placeholder:text-sm placeholder:text-muted focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent"
                />
                <p className="text-xs text-muted">
                  Optional. You can skip this and connect Canvas later from the You tab.
                </p>
              </div>

              <details className="rounded-xl border border-foreground/10 bg-surface p-4">
                <summary className="cursor-pointer text-sm font-medium select-none">
                  Where do I find my token?
                </summary>
                <ol className="mt-3 flex list-decimal flex-col gap-1.5 pl-4 text-sm leading-relaxed text-foreground/75">
                  <li>Open Canvas and go to Account, then Settings.</li>
                  <li>
                    Scroll down to <strong>Approved Integrations</strong>.
                  </li>
                  <li>
                    Click <strong>+ New Access Token</strong>.
                  </li>
                  <li>Put &quot;Ledger&quot; as the purpose and leave the expiry date blank.</li>
                  <li>
                    Click Generate Token, then copy it. Canvas only shows it once, so grab it
                    before you close the box.
                  </li>
                </ol>
                <p className="mt-3 text-xs text-muted">
                  If there&apos;s no &quot;+ New Access Token&quot; button, your district has turned
                  them off. Tell me and I&apos;ll figure out another way in.
                </p>
              </details>
            </>
          ) : (
            <div className="rounded-xl border border-foreground/10 bg-surface p-4">
              <p className="text-sm font-medium">Canvas connect is coming soon</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                Canvas is rolling out gradually while things get tested. You&apos;ll get access
                soon. Finish setting up and you&apos;ll be ready when it opens.
              </p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex h-12 items-center justify-center rounded-lg border border-foreground/15 px-5 text-sm font-medium hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex h-12 flex-1 items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-black transition-transform hover:brightness-110 active:scale-[0.98] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {pending ? 'Finishing…' : 'Finish'}
            </button>
          </div>

          <p className="text-xs text-muted">
            Connecting Canvas takes about 30 seconds while your classes sync.
          </p>

          {state.error && (
            <p role="alert" className="text-sm text-urgent">
              {state.error}
            </p>
          )}
        </section>
      </form>
    </div>
  )
}
