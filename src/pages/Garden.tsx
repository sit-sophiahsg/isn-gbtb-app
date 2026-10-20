import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { GardenScene } from '../components/GardenScene'
import { api } from '../lib/api'
import { lastEventCode, rememberEventCode } from '../lib/eventCode'
import type { GardenFlower } from '../lib/types'
import { useSession } from '../state/session'

const REFRESH_MS = 15_000

export function Garden() {
  const { event, student } = useSession()
  const [params, setParams] = useSearchParams()
  const newId = params.get('new')
  const code = (params.get('code') || event?.code || lastEventCode() || (api.demo ? 'GBTB26' : '')).toUpperCase()

  const [flowers, setFlowers] = useState<GardenFlower[] | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [stale, setStale] = useState(false)
  const [growing, setGrowing] = useState<Set<string>>(new Set())
  const [view, setView] = useState<'garden' | 'cards'>('garden')
  const [selected, setSelected] = useState<GardenFlower | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const known = useRef<Set<string> | null>(null)
  const openedNew = useRef(false)
  const stage = useRef<HTMLDivElement>(null)

  const refresh = useCallback(async () => {
    if (!code) return
    try {
      const list = await api.fetchGarden(code)
      if (!list) {
        setNotFound(true)
        return
      }
      setNotFound(false)
      setStale(false)
      // Flowers that weren't here last time grow up out of the ground (plus the one just planted).
      const prev = known.current
      const arrived = new Set(list.filter((f) => (prev ? !prev.has(f.id) : f.id === newId)).map((f) => f.id))
      known.current = new Set(list.map((f) => f.id))
      setGrowing(arrived)
      setFlowers(list)
      setSelected((s) => (s && !list.some((f) => f.id === s.id) ? null : s))
      if (newId && !openedNew.current) {
        const mine = list.find((f) => f.id === newId)
        if (mine) {
          openedNew.current = true
          setTimeout(() => setSelected(mine), 1700)
        }
      }
    } catch (e) {
      console.error(e)
      setStale(true)
    }
  }, [code, newId])

  useEffect(() => {
    void refresh()
    const t = setInterval(() => void refresh(), REFRESH_MS)
    return () => clearInterval(t)
  }, [refresh])

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void stage.current?.requestFullscreen?.()
  }

  if (!code || notFound) return <CodeForm notFound={notFound} onCode={(c) => setParams({ code: c })} />

  const count = flowers?.length ?? 0

  return (
    <main className="paper min-h-dvh pb-8">
      <header className="sticky top-0 z-20 border-b border-rule bg-paper/95 px-3 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 py-2">
          <div className="flex items-center gap-2">
            {student && (
              <Link to="/passport" className="flex min-h-12 items-center gap-1 px-1 font-semibold">
                <span aria-hidden="true">←</span> <span className="sr-only sm:not-sr-only">Passport</span>
              </Link>
            )}
            <div>
              <h1 className="font-serif text-2xl leading-none">The Garden</h1>
              <p className="text-sm text-ink-soft" aria-live="polite">
                {flowers ? `${count} ${count === 1 ? 'flower' : 'flowers'} planted` : 'Loading…'}
                {stale && ' · offline, retrying'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div role="tablist" aria-label="View" className="flex rounded-xl border-2 border-rule p-0.5">
              {(['garden', 'cards'] as const).map((v) => (
                <button
                  key={v}
                  role="tab"
                  aria-selected={view === v}
                  onClick={() => setView(v)}
                  className={`min-h-11 rounded-lg px-4 font-semibold capitalize ${view === v ? 'btn-primary' : ''}`}
                >
                  {v}
                </button>
              ))}
            </div>
            {view === 'garden' && (
              <button onClick={toggleFullscreen} className="hidden min-h-12 rounded-xl border-2 border-rule px-3 font-semibold sm:block" title="Show full screen (for a projector or TV)">
                ⛶ Full screen
              </button>
            )}
          </div>
        </div>
      </header>

      {view === 'garden' ? (
        <div className="mx-auto max-w-6xl px-0 sm:px-4 sm:pt-4">
          <div
            ref={stage}
            className={`relative w-full overflow-hidden bg-paper ${fullscreen ? 'h-screen' : 'h-[72dvh] min-h-[420px] sm:h-auto sm:min-h-0 sm:aspect-video sm:rounded-2xl sm:border sm:border-rule'}`}
          >
            {flowers && (
              <GardenScene flowers={flowers} growing={growing} highlight={newId} onSelect={setSelected} />
            )}
            {flowers && count === 0 && (
              <p className="absolute inset-x-0 top-1/4 text-center font-serif text-2xl text-ink-soft">No flowers yet. Be the first to plant one!</p>
            )}
            {fullscreen && (
              <div className="pointer-events-none absolute top-4 left-6 text-ink">
                <p className="font-serif text-4xl drop-shadow-sm">Postcards from Singapore · The Garden</p>
                <p className="text-xl text-ink-soft">{count} flowers planted</p>
              </div>
            )}
            {fullscreen && (
              <button onClick={toggleFullscreen} className="absolute top-4 right-4 min-h-12 rounded-xl bg-paper/80 px-4 font-semibold">
                Exit full screen
              </button>
            )}
            {selected && <FlowerCard flower={selected} onClose={() => setSelected(null)} mine={selected.id === newId} />}
          </div>
          <p className="mt-3 px-4 text-center text-sm text-ink-soft">Tap a flower to read its story. The garden updates every 15 seconds.</p>
          {student && (
            <p className="mt-2 text-center">
              <Link to="/plant" className="font-semibold underline">
                Plant or change your flower
              </Link>
            </p>
          )}
        </div>
      ) : (
        <div className="mx-auto max-w-6xl px-4 pt-4">
          {flowers && count === 0 && <p className="py-10 text-center text-ink-soft">No flowers yet. Be the first to plant one!</p>}
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {flowers?.map((f) => (
              <li key={f.id} className="flex gap-4 rounded-2xl border border-rule bg-paper/80 p-4 shadow-sm">
                <div className="flex size-24 shrink-0 items-center justify-center rounded-xl bg-[radial-gradient(circle,#e6f2df,#c9e2bf)] dark:bg-[radial-gradient(circle,#2d4a33,#1e3323)]">
                  <img src={f.imageUrl} alt={`Drawing of ${f.flowerName}`} className="size-20 object-contain" loading="lazy" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-serif text-xl leading-tight break-words">{f.flowerName}</h2>
                  <p className="text-sm font-semibold text-ink-soft">
                    {f.firstName} · {f.country}
                  </p>
                  <p className="mt-1 break-words">{f.meaning}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  )
}

function FlowerCard({ flower, onClose, mine }: { flower: GardenFlower; onClose(): void; mine: boolean }) {
  const close = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    close.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="flower-card-title"
        onClick={(e) => e.stopPropagation()}
        className="paper fade-up relative w-full max-w-sm rounded-2xl border border-rule p-5 text-center shadow-2xl"
      >
        <button ref={close} onClick={onClose} aria-label="Close" className="absolute top-2 right-2 flex size-11 items-center justify-center rounded-full text-2xl">
          ×
        </button>
        {mine && <p className="font-mono text-xs tracking-[0.2em] text-ok uppercase">Your flower is planted!</p>}
        <img src={flower.imageUrl} alt={`Drawing of ${flower.flowerName}`} className="mx-auto my-2 size-36 object-contain" />
        <h2 id="flower-card-title" className="font-serif text-2xl leading-tight break-words">
          {flower.flowerName}
        </h2>
        <p className="mt-1 font-semibold text-ink-soft">
          Planted by {flower.firstName}, from {flower.country}
        </p>
        <p className="mt-3 text-lg break-words">{flower.meaning}</p>
      </div>
    </div>
  )
}

function CodeForm({ notFound, onCode }: { notFound: boolean; onCode(code: string): void }) {
  const [value, setValue] = useState('')
  function submit(e: FormEvent) {
    e.preventDefault()
    const c = value.trim().toUpperCase()
    if (!c) return
    rememberEventCode(c)
    onCode(c)
  }
  return (
    <main className="paper flex min-h-dvh items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-rule bg-paper p-6">
        <h1 className="font-serif text-2xl">The Garden</h1>
        <p className="text-ink-soft">{notFound ? "We couldn't find that event code." : 'Enter the event code to see the garden.'}</p>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          aria-label="Event code"
          className="block min-h-13 w-full rounded-xl border-2 border-rule bg-paper px-4 py-3 text-lg"
          placeholder="Event code"
        />
        <button className="btn-primary min-h-13 w-full rounded-xl font-semibold">Show garden</button>
      </form>
    </main>
  )
}
