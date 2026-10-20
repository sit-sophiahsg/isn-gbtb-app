import { useEffect, useMemo, useState, type ChangeEvent, type CSSProperties } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Stamp } from '../components/Stamp'
import { compressPhoto } from '../lib/image'
import { REFLECTION_MAX, getStamps, type StampDef } from '../lib/stamps'
import type { StampKey } from '../lib/types'
import { useSession } from '../state/session'

/** The reflection text is kept for this tab only, in case opening the camera makes the page reload. */
function draftKey(studentId: string, stampKey: string) {
  return `postcards:draft:${studentId}:${stampKey}`
}
function readDraft(k: string): string | null {
  try {
    return sessionStorage.getItem(k)
  } catch {
    return null
  }
}
function writeDraft(k: string, text: string | null) {
  try {
    if (text === null) sessionStorage.removeItem(k)
    else sessionStorage.setItem(k, text)
  } catch {
    // Not critical.
  }
}

export function StampActivity() {
  const { key } = useParams<{ key: StampKey }>()
  const { event, student, submissions, saveSubmission } = useSession()
  const navigate = useNavigate()
  const def = getStamps(event).find((s) => s.key === key)
  const existing = key ? submissions[key] : undefined
  const dKey = student && key ? draftKey(student.id, key) : ''

  const [newPhoto, setNewPhoto] = useState<Blob | null>(null)
  const [reflection, setReflection] = useState(() => (dKey && readDraft(dKey)) || existing?.reflection || '')
  const [processing, setProcessing] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [justInked, setJustInked] = useState(false)

  // Fill in the saved reflection if the stamps finish loading after this screen opened.
  const existingReflection = existing?.reflection
  useEffect(() => {
    if (existingReflection) setReflection((r) => r || existingReflection)
  }, [existingReflection])

  const newPhotoUrl = useMemo(() => (newPhoto ? URL.createObjectURL(newPhoto) : null), [newPhoto])
  useEffect(() => () => void (newPhotoUrl && URL.revokeObjectURL(newPhotoUrl)), [newPhotoUrl])

  if (!def || !key) return <Navigate to="/passport" replace />
  if (!student) return null

  const photoUrl = newPhotoUrl ?? existing?.photoUrl ?? null

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setProcessing(true)
    setPhotoError(null)
    try {
      setNewPhoto(await compressPhoto(file))
    } catch {
      setPhotoError("That photo couldn't be opened. Please try another one.")
    } finally {
      setProcessing(false)
    }
  }

  const trimmed = reflection.trim()
  const unchanged = !!existing && !newPhoto && trimmed === existing.reflection
  const canSubmit = !!photoUrl && trimmed.length > 0 && !processing && !saving && !unchanged

  async function submit() {
    if (!canSubmit || !key) return
    setSaving(true)
    setSaveError(false)
    try {
      await saveSubmission({ stampKey: key, photo: newPhoto, reflection: trimmed })
      writeDraft(dKey, null)
      navigator.vibrate?.([18, 40, 30])
      setJustInked(true)
    } catch {
      setSaveError(true)
    } finally {
      setSaving(false)
    }
  }

  if (justInked) return <Inked def={def} onDone={() => navigate('/passport')} />

  const captureMode = key === 'swap_story' ? 'user' : 'environment'

  return (
    <main className="paper min-h-dvh pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-10 border-b border-rule bg-paper/95 px-2 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-md items-center">
          <Link to="/passport" className="flex min-h-12 items-center gap-1 px-3 font-semibold">
            <span aria-hidden="true">←</span> Passport
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-md space-y-6 px-5 pt-5">
        <div className="flex items-center gap-4">
          <Stamp def={def} inked={!!existing} className="w-24 shrink-0" />
          <div>
            <p className="font-mono text-xs tracking-[0.2em] text-ink-soft uppercase">{existing ? 'Collected' : 'Stamp activity'}</p>
            <h1 className="font-serif text-[1.75rem] leading-tight">{def.title}</h1>
          </div>
        </div>

        <div className="space-y-3 text-[1.0625rem]">
          {def.prompt.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        <section aria-labelledby="photo-h" className="space-y-3">
          <h2 id="photo-h" className="font-semibold">
            1. Photo <span className="font-normal text-ink-soft">({def.photoHint.toLowerCase()})</span>
          </h2>
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={trimmed || def.photoHint}
              className="max-h-[55vh] w-full rounded-2xl border border-rule bg-paper-2 object-contain shadow-sm"
            />
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center rounded-2xl border-2 border-dashed border-rule bg-paper-2/60 p-6 text-center text-ink-soft">
              {processing ? 'Preparing photo…' : 'No photo yet'}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className={pickCls}>
              <input type="file" accept="image/*" capture={captureMode} onChange={onPick} className="sr-only" />
              <span aria-hidden="true">📷</span> {photoUrl ? 'Retake' : 'Take photo'}
            </label>
            <label className={pickCls}>
              <input type="file" accept="image/*" onChange={onPick} className="sr-only" />
              <span aria-hidden="true">🖼️</span> Gallery
            </label>
          </div>
          {photoError && <p className="font-semibold text-accent">{photoError}</p>}
        </section>

        <section className="space-y-2">
          <label htmlFor="reflection" className="block font-semibold">
            2. Your reflection
          </label>
          <textarea
            id="reflection"
            value={reflection}
            onChange={(e) => {
              const v = e.target.value.slice(0, REFLECTION_MAX)
              setReflection(v)
              writeDraft(dKey, v)
            }}
            maxLength={REFLECTION_MAX}
            rows={5}
            className="block w-full rounded-xl border-2 border-rule bg-paper px-4 py-3 text-lg leading-relaxed focus:border-cover focus:outline-none dark:focus:border-gold"
            placeholder="Write a few sentences…"
          />
          <p className={`text-right font-mono text-sm ${reflection.length >= REFLECTION_MAX - 20 ? 'text-accent' : 'text-ink-soft'}`}>
            {reflection.length} / {REFLECTION_MAX}
          </p>
        </section>

        {saveError ? (
          <div role="alert" className="space-y-3 rounded-2xl border-2 border-accent/50 bg-accent/10 p-4">
            <p className="font-semibold">Your stamp didn't upload.</p>
            <p className="text-ink-soft">Check your mobile data, then try again. Your photo and reflection are still here.</p>
            <button
              onClick={() => void submit()}
              disabled={saving}
              className="btn-primary min-h-14 w-full rounded-2xl px-6 text-lg font-semibold shadow-md disabled:opacity-60"
            >
              {saving ? 'Uploading…' : 'Try again'}
            </button>
          </div>
        ) : (
          <button
            onClick={() => void submit()}
            disabled={!canSubmit}
            className="btn-primary min-h-14 w-full rounded-2xl px-6 text-lg font-semibold shadow-md transition active:scale-[0.98] disabled:opacity-45"
          >
            {saving ? 'Uploading…' : existing ? (unchanged ? 'Stamp collected ✓' : 'Update my stamp') : 'Collect stamp'}
          </button>
        )}
        {!photoUrl && trimmed && <p className="-mt-3 text-center text-sm text-ink-soft">Add a photo to collect this stamp.</p>}
        {photoUrl && !trimmed && <p className="-mt-3 text-center text-sm text-ink-soft">Write a short reflection to collect this stamp.</p>}
      </div>
    </main>
  )
}

const pickCls =
  'flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-cover/70 bg-paper px-3 font-semibold text-cover focus-within:outline-3 focus-within:outline-gold active:scale-[0.98] dark:border-gold/70 dark:text-gold'

function Inked({ def, onDone }: { def: StampDef; onDone: () => void }) {
  return (
    <main className="paper flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="relative w-64 max-w-[75vw]">
        <div
          aria-hidden="true"
          className="ink-splash stamp absolute inset-0 rounded-full border-[10px] border-current"
          style={{ '--stamp-ink': def.ink, '--stamp-ink-dark': def.inkDark } as CSSProperties}
        />
        <Stamp def={def} inked press className="relative w-full" />
      </div>
      <h1 className="fade-up mt-8 font-serif text-3xl" style={{ animationDelay: '500ms' }}>
        Stamp collected!
      </h1>
      <button
        onClick={onDone}
        autoFocus
        className="btn-primary fade-up mt-8 min-h-14 rounded-2xl px-8 text-lg font-semibold shadow-md"
        style={{ animationDelay: '650ms' }}
      >
        Back to my passport
      </button>
    </main>
  )
}
