import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DrawingCanvas, type DrawingHandle } from '../components/DrawingCanvas'
import { PageHeader } from '../components/PageHeader'
import { api } from '../lib/api'
import type { GardenFlower } from '../lib/types'
import { useSession } from '../state/session'

const NAME_MAX = 40
const MEANING_MAX = 200

export function Plant() {
  const { student } = useSession()
  const navigate = useNavigate()
  const drawing = useRef<DrawingHandle>(null)
  const [mine, setMine] = useState<GardenFlower | null | undefined>(undefined)
  const [redraw, setRedraw] = useState(false)
  const [empty, setEmpty] = useState(true)
  const [name, setName] = useState('')
  const [meaning, setMeaning] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [touched, setTouched] = useState(false)
  const onChange = useCallback((e: boolean) => setEmpty(e), [])

  useEffect(() => {
    if (!student) return
    api
      .fetchMyFlower(student)
      .then((f) => {
        setMine(f)
        if (f) {
          setName(f.flowerName)
          setMeaning(f.meaning)
        }
      })
      .catch(() => setMine(null))
  }, [student])

  if (!student || mine === undefined) return <main className="paper min-h-dvh" aria-busy="true" />

  async function plant() {
    setTouched(true)
    if (!student || empty || !name.trim() || !meaning.trim() || busy) return
    setBusy(true)
    setError(false)
    try {
      const image = await drawing.current?.toBlob()
      if (!image) return
      const f = await api.plantFlower(student, { image, flowerName: name.trim(), meaning: meaning.trim() })
      navigate(`/garden?new=${encodeURIComponent(f.id)}`)
    } catch (e) {
      console.error(e)
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  if (mine && !redraw) {
    return (
      <main className="paper min-h-dvh pb-8">
        <PageHeader title="Your flower" />
        <div className="mx-auto max-w-md space-y-5 px-5 pt-6 text-center">
          <h1 className="font-serif text-3xl">Your flower is planted</h1>
          <img src={mine.imageUrl} alt={`Your flower drawing, ${mine.flowerName}`} className="mx-auto w-56" />
          <div>
            <p className="font-serif text-2xl">{mine.flowerName}</p>
            <p className="mt-1 text-ink-soft">{mine.meaning}</p>
          </div>
          <Link to={`/garden?new=${encodeURIComponent(mine.id)}`} className="btn-primary flex min-h-14 items-center justify-center rounded-2xl text-lg font-semibold">
            See it in the garden
          </Link>
          <button onClick={() => setRedraw(true)} className="min-h-12 font-semibold underline">
            Draw a new flower instead
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="paper min-h-dvh pb-[max(2rem,env(safe-area-inset-bottom))]">
      <PageHeader title="Plant a flower" />
      <div className="mx-auto max-w-md space-y-5 px-5 pt-5">
        <div>
          <h1 className="font-serif text-3xl leading-tight">Plant a flower</h1>
          <p className="mt-1 text-ink-soft">
            Draw a flower that represents you, your culture, or your time in Singapore. It will grow in the shared garden with
            everyone else's.
          </p>
        </div>

        <DrawingCanvas ref={drawing} onChange={onChange} />
        {touched && empty && <p className="-mt-2 font-semibold text-accent">Draw your flower first.</p>}

        <div className="space-y-1.5">
          <label htmlFor="fname" className="block font-semibold">
            Name your flower
          </label>
          <input
            id="fname"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
            maxLength={NAME_MAX}
            placeholder="e.g. Saudade bloom"
            className="block min-h-13 w-full rounded-xl border-2 border-rule bg-paper px-4 py-3 text-lg focus:border-cover focus:outline-none dark:focus:border-gold"
          />
          {touched && !name.trim() && <p className="text-sm font-semibold text-accent">Give your flower a name.</p>}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="meaning" className="block font-semibold">
            What does it represent?
          </label>
          <textarea
            id="meaning"
            value={meaning}
            onChange={(e) => setMeaning(e.target.value.slice(0, MEANING_MAX))}
            maxLength={MEANING_MAX}
            rows={3}
            placeholder="Yourself, your culture, or your time in Singapore"
            className="block w-full rounded-xl border-2 border-rule bg-paper px-4 py-3 text-lg focus:border-cover focus:outline-none dark:focus:border-gold"
          />
          <p className="text-right font-mono text-sm text-ink-soft">
            {meaning.length} / {MEANING_MAX}
          </p>
          {touched && !meaning.trim() && <p className="-mt-5 text-sm font-semibold text-accent">Tell us what it represents.</p>}
        </div>

        <p className="text-sm text-ink-soft">Your flower, its name and your first name and country will be shown in the garden.</p>

        {error && (
          <p role="alert" className="rounded-xl border-2 border-accent/50 bg-accent/10 p-4 font-medium">
            Your flower didn't upload. Check your mobile data and try again.
          </p>
        )}

        <button
          onClick={() => void plant()}
          disabled={busy}
          className="btn-primary min-h-14 w-full rounded-2xl px-6 text-lg font-semibold shadow-md disabled:opacity-60"
        >
          {busy ? 'Planting…' : error ? 'Try again' : mine ? 'Replant my flower' : 'Plant my flower'}
        </button>
      </div>
    </main>
  )
}
