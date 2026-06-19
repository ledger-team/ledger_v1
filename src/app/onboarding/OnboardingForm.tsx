'use client'

import { useActionState, useState } from 'react'
import { LedgerLoader } from '@/components/LedgerLoader'
import { completeOnboarding, type OnboardingState } from './actions'

type School = { id: string; name: string }

export function OnboardingForm({
  schools,
  canPasteToken,
  defaultName,
}: {
  schools: School[]
  canPasteToken: boolean
  defaultName: string
}) {
  const [step, setStep] = useState<1 | 2>(1)
  const [state, formAction, pending] = useActionState<OnboardingState, FormData>(
    completeOnboarding,
    {},
  )

  // While the submit runs, completeOnboarding does saveToken + syncUserCanvas
  // inline (15-40s) before redirecting — so `pending` IS the sync wait. Show the
  // branded loader in place of the form instead of a frozen button.
  if (pending) return <LedgerLoader label="Syncing your courses…" />

  // Both steps stay mounted (step 2 hides step 1 via CSS) so all fields are in
  // the FormData when the final submit fires.
  return (
    <form action={formAction} className="flex flex-col gap-5">
      <section className={step === 1 ? 'flex flex-col gap-4' : 'hidden'}>
        <div className="flex flex-col gap-1">
          <label htmlFor="name" className="text-sm font-medium">
            Your name
          </label>
          <input
            id="name"
            name="name"
            defaultValue={defaultName}
            required
            placeholder="Sam Berry"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="schoolId" className="text-sm font-medium">
            High school
          </label>
          <select
            id="schoolId"
            name="schoolId"
            required
            defaultValue=""
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
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
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="gradYear" className="text-sm font-medium">
            Graduation year
          </label>
          <input
            id="gradYear"
            name="gradYear"
            type="number"
            required
            placeholder="2027"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => setStep(2)}
          className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white"
        >
          Continue
        </button>
      </section>

      <section className={step === 2 ? 'flex flex-col gap-4' : 'hidden'}>
        <div>
          <h2 className="text-sm font-medium">Connect Canvas</h2>
          {canPasteToken ? (
            <div className="mt-2 flex flex-col gap-2">
              <p className="text-sm text-gray-500">
                Paste your Canvas access token to sync your courses (optional — you can
                finish without it). It&apos;s encrypted before it&apos;s stored.
              </p>
              <textarea
                name="canvasToken"
                rows={3}
                placeholder="Canvas access token"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          ) : (
            <div className="mt-2 rounded-md bg-gray-50 p-3">
              <p className="text-sm font-medium">Canvas connect — coming soon</p>
              <p className="mt-1 text-sm text-gray-500">
                We&apos;re rolling Canvas integration out gradually. You&apos;ll get access soon.
              </p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? 'Finishing…' : 'Finish'}
          </button>
        </div>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      </section>
    </form>
  )
}
