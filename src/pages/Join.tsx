import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Emblem } from '../components/Emblem'
import { COUNTRIES } from '../lib/countries'
import { lastEventCode, rememberEventCode } from '../lib/eventCode'
import { cleanFirstName, isValidStudentId } from '../lib/validation'
import { useSession } from '../state/session'

export function Join() {
  const { join } = useSession()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const codeFromLink = (params.get('code') ?? '').trim().toUpperCase() || lastEventCode()

  const [eventCode, setEventCode] = useState(codeFromLink)
  const [editCode, setEditCode] = useState(!codeFromLink)
  const [studentId, setStudentId] = useState('')
  const [firstName, setFirstName] = useState('')
  const [country, setCountry] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  const idOk = isValidStudentId(studentId)
  const ready = eventCode.trim() && idOk && cleanFirstName(firstName) && country.trim() && consent

  async function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (!ready || busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await join({
        eventCode: eventCode.trim().toUpperCase(),
        studentId: studentId.trim(),
        firstName: cleanFirstName(firstName),
        country: country.trim(),
      })
      if (result.ok) {
        rememberEventCode(result.event.code)
        navigate('/passport', { replace: true, state: { welcome: result.rejoined ? 'back' : 'new' } })
        return
      }
      setError(
        {
          bad_event: "We couldn't find that event code. Check the code on the poster or QR sign.",
          name_mismatch:
            "This student ID is already registered with a different first name. If it's yours, type your first name the way you did the first time, or ask an organiser for help.",
          network: "Couldn't connect. Check your mobile data and try again.",
        }[result.reason],
      )
    } catch {
      setError("Couldn't connect. Check your mobile data and try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-dvh bg-cover-deep">
      <header className="relative overflow-hidden bg-cover px-6 pt-[max(2.5rem,env(safe-area-inset-top))] pb-10 text-center text-gold">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{ backgroundImage: 'var(--guilloche)', filter: 'invert(1)' }}
        />
        <p className="relative font-mono text-xs tracking-[0.35em] uppercase">Passport</p>
        <Emblem className="relative mx-auto my-4 w-24" />
        <h1 className="relative font-serif text-[2rem] leading-tight">Postcards from Singapore</h1>
        <p className="relative mt-2 text-sm text-gold-soft dark:text-gold">Gardens by the Bay · Flower Dome</p>
        <p className="relative font-mono text-xs tracking-[0.2em] text-gold-soft uppercase dark:text-gold">
          Christmas Train Show 2026
        </p>
      </header>

      <form
        onSubmit={submit}
        noValidate
        className="paper relative -mt-4 rounded-t-3xl px-5 pt-7 pb-[max(2rem,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto max-w-md space-y-5">
          <div>
            <h2 className="font-serif text-2xl">Open your passport</h2>
            <p className="mt-1 text-ink-soft">
              Using a new phone? Enter the same student ID and first name as before to get your passport back.
            </p>
          </div>

          {editCode ? (
            <Field label="Event code" htmlFor="code">
              <input
                id="code"
                value={eventCode}
                onChange={(e) => setEventCode(e.target.value.toUpperCase())}
                autoCapitalize="characters"
                autoComplete="off"
                className={inputCls}
                placeholder="On the poster"
              />
            </Field>
          ) : (
            <p className="flex items-center justify-between rounded-xl bg-paper-2 px-4 py-3">
              <span>
                Event code <span className="font-mono font-bold">{eventCode}</span>
              </span>
              <button type="button" onClick={() => setEditCode(true)} className="min-h-11 px-2 font-semibold text-accent underline">
                Change
              </button>
            </p>
          )}

          <Field
            label="Student ID"
            htmlFor="sid"
            hint="Your 7-digit SIT student ID"
            error={touched && !idOk ? 'Please enter your 7-digit student ID (numbers only).' : undefined}
          >
            <input
              id="sid"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value.replace(/\D/g, '').slice(0, 7))}
              inputMode="numeric"
              autoComplete="off"
              maxLength={7}
              className={`${inputCls} font-mono tracking-[0.2em]`}
              placeholder="2500000"
            />
          </Field>

          <Field
            label="First name"
            htmlFor="fname"
            hint="Only your first name is shown to others"
            error={touched && !cleanFirstName(firstName) ? 'Please enter your first name.' : undefined}
          >
            <input
              id="fname"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
              maxLength={30}
              className={inputCls}
            />
          </Field>

          <Field
            label="Home country"
            htmlFor="country"
            error={touched && !country.trim() ? 'Please enter your home country.' : undefined}
          >
            <input
              id="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              list="countries"
              autoComplete="country-name"
              maxLength={40}
              className={inputCls}
              placeholder="Start typing…"
            />
            <datalist id="countries">
              {COUNTRIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>

          <label className="flex cursor-pointer gap-3 rounded-xl border border-rule bg-paper-2/60 p-4 text-[0.95rem]">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 size-6 shrink-0 accent-[var(--cover)]"
            />
            <span>
              I understand that only my first name is shown publicly, my photos and reflections may appear on the event's
              garden wall, and all data, including my student ID, is deleted after the event.
            </span>
          </label>
          {touched && !consent && <p className="-mt-3 text-sm font-semibold text-accent">Please tick the box to continue.</p>}

          {error && (
            <p role="alert" className="rounded-xl border border-accent/40 bg-accent/10 p-4 font-medium">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="min-h-14 w-full btn-primary rounded-2xl px-6 text-lg font-semibold shadow-md transition active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? 'Opening…' : 'Open my passport'}
          </button>

        </div>
      </form>
    </main>
  )
}

const inputCls =
  'block min-h-13 w-full rounded-xl border-2 border-rule bg-paper px-4 py-3 text-lg text-ink placeholder:text-ink-soft/60 focus:border-cover focus:outline-none dark:focus:border-gold'

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block font-semibold">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-sm font-semibold text-accent">{error}</p>
      ) : (
        hint && <p className="mt-1.5 text-sm text-ink-soft">{hint}</p>
      )}
    </div>
  )
}
