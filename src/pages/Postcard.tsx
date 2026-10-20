import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { api } from '../lib/api'
import { MESSAGE_MAX, TO_MAX, renderPostcard } from '../lib/postcard'
import { getStamps } from '../lib/stamps'
import type { StampKey } from '../lib/types'
import { useSession } from '../state/session'

export function Postcard() {
  const { event, student, submissions } = useSession()
  const stamps = getStamps(event)
  const collected = stamps.filter((s) => submissions[s.key])
  const [picked, setPicked] = useState<StampKey | null>(null)
  const [message, setMessage] = useState('')
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Blob | null>(null)
  const [shareNote, setShareNote] = useState<string | null>(null)

  const choice = picked ?? collected[0]?.key ?? null
  const sub = choice ? submissions[choice] : undefined

  // Start from the chosen stamp's reflection.
  useEffect(() => {
    if (sub) setMessage(sub.reflection.slice(0, MESSAGE_MAX))
  }, [sub])

  const resultUrl = useMemo(() => (result ? URL.createObjectURL(result) : null), [result])
  useEffect(() => () => void (resultUrl && URL.revokeObjectURL(resultUrl)), [resultUrl])

  if (!event || !student) return null

  if (collected.length < stamps.length) {
    return (
      <main className="paper min-h-dvh">
        <PageHeader title="Postcard" />
        <div className="mx-auto max-w-md space-y-4 px-5 pt-8 text-center">
          <h1 className="font-serif text-3xl">Almost there</h1>
          <p className="text-ink-soft">
            Collect all {stamps.length} stamps to unlock the postcard maker. You have {collected.length} so far.
          </p>
          <Link to="/passport" className="btn-primary inline-flex min-h-14 items-center rounded-2xl px-8 text-lg font-semibold">
            Back to my passport
          </Link>
        </div>
      </main>
    )
  }

  async function create() {
    if (!sub || !student || !event) return
    setBusy(true)
    setError(null)
    setShareNote(null)
    try {
      const blob = await renderPostcard({
        photoUrl: sub.photoUrl,
        message,
        to,
        firstName: student.firstName,
        country: student.country,
        eventDate: event.eventDate,
      })
      setResult(blob)
      void api.recordPostcard(student, sub.id)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      console.error(e)
      setError("Couldn't create the postcard. Check your connection and try again.")
    } finally {
      setBusy(false)
    }
  }

  const file = result ? new File([result], 'postcard-from-singapore.png', { type: 'image/png' }) : null
  const canShare = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })

  async function share() {
    if (!file) return
    try {
      await navigator.share({ files: [file], title: 'Postcards from Singapore', text: 'A postcard from Gardens by the Bay 🌸' })
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setShareNote('Sharing didn\'t work on this phone. Use "Save image" instead.')
    }
  }

  if (result && resultUrl) {
    return (
      <main className="paper min-h-dvh pb-[max(2rem,env(safe-area-inset-bottom))]">
        <PageHeader title="Postcard" />
        <div className="mx-auto max-w-2xl space-y-5 px-4 pt-5">
          <h1 className="text-center font-serif text-3xl">Your postcard is ready</h1>
          <img
            src={resultUrl}
            alt={`Postcard: ${message}`}
            className="fade-up w-full rounded-lg shadow-[0_14px_40px_-12px_rgba(0,0,0,0.45)]"
          />
          <div className="mx-auto grid max-w-md gap-3">
            {canShare && (
              <button onClick={() => void share()} className="btn-primary min-h-14 rounded-2xl px-6 text-lg font-semibold shadow-md">
                Send postcard
              </button>
            )}
            <a
              href={resultUrl}
              download="postcard-from-singapore.png"
              className={`flex min-h-14 items-center justify-center rounded-2xl px-6 text-lg font-semibold ${canShare ? 'border-2 border-cover text-cover dark:border-gold dark:text-gold' : 'btn-primary shadow-md'}`}
            >
              Save image
            </a>
            {shareNote && <p className="text-center text-sm text-accent">{shareNote}</p>}
            <p className="text-center text-sm text-ink-soft">
              Send it on WhatsApp, Instagram or email. On iPhone you can also press and hold the image to save it.
            </p>
            <button onClick={() => setResult(null)} className="min-h-12 font-semibold underline">
              Edit postcard
            </button>
            <Link to="/passport" className="flex min-h-12 items-center justify-center text-ink-soft underline">
              Back to my passport
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="paper min-h-dvh pb-[max(2rem,env(safe-area-inset-bottom))]">
      <PageHeader title="Postcard" />
      <div className="mx-auto max-w-md space-y-6 px-5 pt-5">
        <div>
          <h1 className="font-serif text-3xl leading-tight">Make your postcard</h1>
          <p className="mt-1 text-ink-soft">Turn your favourite moment into a postcard to send to family and friends.</p>
        </div>

        <section className="space-y-3">
          <h2 className="font-semibold">1. Pick a moment</h2>
          <div className="grid grid-cols-2 gap-3">
            {collected.map((s) => {
              const sb = submissions[s.key]!
              const selected = s.key === choice
              return (
                <button
                  key={s.key}
                  onClick={() => setPicked(s.key)}
                  aria-pressed={selected}
                  className={`overflow-hidden rounded-xl border-2 text-left transition ${selected ? 'border-cover ring-2 ring-cover/30 dark:border-gold dark:ring-gold/30' : 'border-rule'}`}
                >
                  <img src={sb.photoUrl} alt="" className="aspect-[4/3] w-full bg-paper-2 object-cover" />
                  <span className="block px-2 py-1.5 text-sm font-semibold leading-snug">
                    {selected && <span aria-hidden="true">✓ </span>}
                    {s.title}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="space-y-2">
          <label htmlFor="msg" className="block font-semibold">
            2. Your message
          </label>
          <textarea
            id="msg"
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_MAX))}
            maxLength={MESSAGE_MAX}
            rows={6}
            className="block w-full rounded-xl border-2 border-rule bg-paper px-4 py-3 font-hand text-2xl leading-snug focus:border-cover focus:outline-none dark:focus:border-gold"
          />
          <p className="text-right font-mono text-sm text-ink-soft">
            {message.length} / {MESSAGE_MAX}
          </p>
        </section>

        <section className="space-y-2">
          <label htmlFor="to" className="block font-semibold">
            3. Who is it for?
          </label>
          <input
            id="to"
            value={to}
            onChange={(e) => setTo(e.target.value.slice(0, TO_MAX))}
            maxLength={TO_MAX}
            placeholder="Mum and Dad"
            className="block min-h-13 w-full rounded-xl border-2 border-rule bg-paper px-4 py-3 font-hand text-2xl focus:border-cover focus:outline-none dark:focus:border-gold"
          />
        </section>

        {error && (
          <p role="alert" className="rounded-xl border border-accent/40 bg-accent/10 p-4 font-medium">
            {error}
          </p>
        )}

        <button
          onClick={() => void create()}
          disabled={busy || !message.trim() || !sub}
          className="btn-primary min-h-14 w-full rounded-2xl px-6 text-lg font-semibold shadow-md disabled:opacity-50"
        >
          {busy ? 'Creating…' : error ? 'Try again' : 'Create postcard'}
        </button>
      </div>
    </main>
  )
}
