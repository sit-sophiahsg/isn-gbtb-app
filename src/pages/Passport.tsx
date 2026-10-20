import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { PhotoPage } from '../components/PhotoPage'
import { Stamp } from '../components/Stamp'
import { SyncPill } from '../components/SyncPill'
import { api } from '../lib/api'
import { getStamps } from '../lib/stamps'
import { useSession } from '../state/session'

export function Passport() {
  const { event, student, submissions, leave } = useSession()
  const location = useLocation()
  const welcome = (location.state as { welcome?: 'new' | 'back' } | null)?.welcome
  const [confirmLeave, setConfirmLeave] = useState(false)

  if (!event || !student) return null
  const stamps = getStamps(event)
  const collected = stamps.filter((s) => submissions[s.key]).length
  const allDone = collected === stamps.length

  return (
    <main className="paper min-h-dvh pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="bg-cover px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-14 text-gold">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[0.7rem] tracking-[0.3em] uppercase">Passport</p>
            <h1 className="font-serif text-xl leading-tight">Postcards from Singapore</h1>
          </div>
          <div className="rounded-2xl bg-paper">
            <SyncPill />
          </div>
        </div>
      </header>

      <div className="mx-auto -mt-10 max-w-md space-y-6 px-4">
        {welcome && (
          <p className="fade-up rounded-xl border border-ok/30 bg-paper p-3 text-center font-medium text-ok">
            {welcome === 'back' ? `Welcome back, ${student.firstName}! Your passport is restored.` : `Welcome, ${student.firstName}! Your passport is ready.`}
          </p>
        )}

        <PhotoPage student={student} event={event} />

        <section aria-labelledby="stamps-h">
          <div className="mb-3 flex items-end justify-between">
            <h2 id="stamps-h" className="font-serif text-2xl">
              Stamps
            </h2>
            <p className="font-mono text-sm font-bold">
              {collected} / {stamps.length} collected
            </p>
          </div>
          <div
            className="mb-4 h-2.5 overflow-hidden rounded-full bg-paper-2"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={stamps.length}
            aria-valuenow={collected}
            aria-label="Stamps collected"
          >
            <div className="h-full rounded-full bg-cover transition-all dark:bg-gold" style={{ width: `${(collected / stamps.length) * 100}%` }} />
          </div>

          <ul className="grid grid-cols-2 gap-3">
            {stamps.map((def, i) => {
              const sub = submissions[def.key]
              return (
                <li key={def.key} className={i === stamps.length - 1 && stamps.length % 2 ? 'col-span-2 mx-auto w-1/2' : ''}>
                  <Link
                    to={`/stamp/${def.key}`}
                    className="flex h-full flex-col items-center rounded-2xl border border-rule bg-paper/70 p-3 text-center shadow-sm transition active:scale-[0.97]"
                  >
                    <Stamp def={def} inked={!!sub} className="w-full max-w-36" />
                    <span className="mt-2 font-semibold leading-snug">{def.title}</span>
                    <span className="text-sm text-ink-soft">
                      {sub ? (sub.sync === 'synced' ? 'Collected ✓' : 'Collected · saved on phone') : 'Tap to start'}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="rounded-2xl border border-rule bg-paper-2/70 p-5">
          <h2 className="font-serif text-xl">{allDone ? 'Postcard unlocked!' : 'Postcard maker'}</h2>
          <p className="mt-1 text-ink-soft">
            {allDone
              ? "You've collected every stamp. The postcard maker arrives in the next build (M3)."
              : `Collect all ${stamps.length} stamps to turn your favourite moment into a postcard to send home.`}
          </p>
        </section>

        <section className="pt-2 text-center text-sm text-ink-soft">
          {confirmLeave ? (
            <div className="space-y-3 rounded-2xl border border-rule p-4">
              <p>
                This removes your passport from this phone. You can get it back any time by entering your student ID and
                first name again. Anything not yet synced will still upload.
              </p>
              <div className="flex justify-center gap-3">
                <button onClick={() => setConfirmLeave(false)} className="min-h-12 rounded-xl border border-rule px-5 font-semibold">
                  Cancel
                </button>
                <button onClick={() => void leave()} className="min-h-12 rounded-xl bg-accent px-5 font-semibold text-white dark:text-paper">
                  Leave this phone
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmLeave(true)} className="min-h-12 px-3 underline">
              Not {student.firstName}? Leave this phone
            </button>
          )}
          {api.demo && <p className="mt-3">Demo mode: data stays on this phone.</p>}
        </section>
      </div>
    </main>
  )
}
