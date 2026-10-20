import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useRally } from '../lib/data'
import { newId, submit } from '../lib/outbox'
import { compressPhoto } from '../lib/compress'
import { describeOutcome, type Tone } from '../lib/messages'
import { photoUrl, supabase } from '../lib/supabase'
import { toast } from '../components/toast'
import { Badge, useRallyOpen } from './StampCard'

export function CheckpointPage() {
  const { id = '' } = useParams()
  const { checkpoints, session, stateOf, stamps, pending } = useRally()
  const { open, started } = useRallyOpen()
  const cp = checkpoints.find((c) => c.id === id)
  const [busy, setBusy] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [savedPhoto, setSavedPhoto] = useState<string | null>(null)
  const camera = useRef<HTMLInputElement>(null)
  const library = useRef<HTMLInputElement>(null)

  const state = stateOf(id)
  const stamp = stamps.find((s) => s.checkpoint_id === id)

  // Show the photo that earned the stamp (from the server) once it's synced.
  useEffect(() => {
    if (!stamp?.photo_id || stamp.status !== 'ok') return
    void supabase.from('photos').select('storage_path').eq('id', stamp.photo_id).maybeSingle()
      .then(({ data }) => { if (data) setSavedPhoto(photoUrl(data.storage_path)) })
  }, [stamp?.photo_id, stamp?.status])

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  if (!cp || !session) {
    return (
      <div className="page pt-10 text-center">
        <p className="text-lg font-bold">Checkpoint not found.</p>
        <Link to="/" className="btn-primary mt-6">Back to stamp card</Link>
      </div>
    )
  }
  const checkpoint = cp
  const sess = session
  const collected = state.kind === 'stamped' || state.kind === 'pending'

  async function onPhoto(file: File | undefined) {
    if (!file) return
    setBusy('photo')
    try {
      const blob = await compressPhoto(file)
      setPreview(URL.createObjectURL(blob))
      const o = await submit(
        {
          kind: 'photo',
          groupId: sess.groupId,
          joinToken: sess.joinToken,
          checkpointId: checkpoint.id,
          path: `${sess.groupId}/${checkpoint.id}-${newId()}.jpg`,
          caption: checkpoint.name,
          data: await blob.arrayBuffer(),
          type: blob.type || 'image/jpeg',
        },
        8000,
      )
      if (o.type === 'queued') toast('Stamp saved! The photo will upload when you have signal.')
      else {
        const m = describeOutcome(o, checkpoints)
        if (m) toast(m.text, m.tone)
      }
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(null)
      if (camera.current) camera.current.value = ''
      if (library.current) library.current.value = ''
    }
  }

  async function leaderStamp() {
    if (!sess.leaderPin) return
    if (!confirm(`Give ${sess.name} the "${checkpoint.name}" stamp manually?`)) return
    setBusy('manual')
    const o = await submit({
      kind: 'manual', groupId: sess.groupId, joinToken: sess.joinToken, checkpointId: checkpoint.id, pin: sess.leaderPin,
    })
    setBusy(null)
    if (o.type === 'queued') toast('Manual stamp saved. It will sync when you have signal.')
    else {
      const m = describeOutcome(o, checkpoints)
      if (m) toast(m.text, m.tone)
    }
  }

  const queuedAnswers = pending.filter((p) => p.kind === 'answer' && p.checkpointId === id).length

  return (
    <div className="page space-y-4">
      <Link to="/" className="inline-block py-2 font-bold text-leaf-700">‹ Stamp card</Link>

      <div className="card space-y-3">
        <div className="flex items-start gap-4">
          <Badge state={state} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-leaf-600 uppercase">Checkpoint {checkpoint.sort_order}</div>
            <h1 className="text-2xl leading-tight font-extrabold">{checkpoint.name}</h1>
          </div>
        </div>
        {checkpoint.location_hint && <p className="text-leaf-900/80">📍 {checkpoint.location_hint}</p>}
        <p className="rounded-2xl bg-leaf-50 p-4 text-lg font-semibold">{checkpoint.task_prompt}</p>
      </div>

      {state.kind === 'rejected' && (
        <p className="rounded-2xl bg-petal/10 p-4 font-semibold text-petal">
          The organisers didn't accept this stamp{state.stamp.rejected_reason ? `: ${state.stamp.rejected_reason}` : ''}.
          {checkpoint.method === 'photo' ? ' Please take a new photo.' : ' Please scan the QR again.'}
        </p>
      )}

      {collected && (
        <div className="card text-center">
          <div className="stamp-in mx-auto w-fit rounded-2xl border-4 border-leaf-600 px-5 py-2 text-2xl font-black tracking-wide text-leaf-700 uppercase">
            Stamped!
          </div>
          {state.kind === 'pending' && <p className="mt-3 text-leaf-900/70">Saved on your phone. It will upload when you have signal.</p>}
          {(preview || savedPhoto) && (
            <img src={preview ?? savedPhoto ?? ''} alt="Your checkpoint photo" className="mt-4 w-full rounded-2xl" />
          )}
        </div>
      )}

      {!collected && (
        !started ? (
          <p className="rounded-2xl bg-leaf-100 p-4 font-semibold">Stamps unlock when the rally starts.</p>
        ) : !open ? (
          <p className="rounded-2xl bg-sun p-4 font-semibold">Time's up. Head back to the meeting point.</p>
        ) : checkpoint.method === 'photo' ? (
          <div className="space-y-3">
            <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={(e) => void onPhoto(e.target.files?.[0])} />
            <input ref={library} type="file" accept="image/*" className="hidden"
              onChange={(e) => void onPhoto(e.target.files?.[0])} />
            <button className="btn-primary text-xl" disabled={!!busy} onClick={() => camera.current?.click()}>
              {busy === 'photo' ? 'Saving photo…' : '📸 Take photo'}
            </button>
            <button className="btn-secondary" disabled={!!busy} onClick={() => library.current?.click()}>
              Choose from photos
            </button>
          </div>
        ) : (
          <Link to="/scan" className="btn-primary text-xl">📷 Scan the QR code</Link>
        )
      )}

      {checkpoint.question && collected && (
        <Question
          question={checkpoint.question}
          attempts={(stamp?.question_attempts ?? 0) + queuedAnswers}
          correct={stamp?.question_correct ?? null}
          points={stamp?.points ?? null}
          onAnswer={async (answer) => {
            const o = await submit({
              kind: 'answer', groupId: sess.groupId, joinToken: sess.joinToken, checkpointId: checkpoint.id, answer,
            }, 8000)
            if (o.type === 'queued') return { text: "Answer saved. We'll check it when you have signal.", tone: 'ok' as Tone }
            return describeOutcome(o, checkpoints)
          }}
        />
      )}

      {checkpoint.question && !collected && (
        <p className="text-center text-leaf-900/70">A question unlocks after you collect this stamp.</p>
      )}

      {sess.leaderPin && !collected && (
        <div className="card space-y-3 border-2 border-dashed border-sun">
          <h2 className="font-extrabold">EXCO leader</h2>
          <p className="text-sm">Use this only if the QR won't scan or the photo won't upload.</p>
          <button className="btn-secondary" disabled={!!busy} onClick={() => void leaderStamp()}>
            {busy === 'manual' ? 'Saving…' : 'Give stamp manually'}
          </button>
        </div>
      )}
    </div>
  )
}

function Question(props: {
  question: string
  attempts: number
  correct: boolean | null
  points: number | null
  onAnswer: (a: string) => Promise<{ text: string; tone: Tone } | null>
}) {
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; tone: Tone } | null>(null)
  const left = Math.max(0, 3 - props.attempts)
  const finished = props.correct !== null || left === 0

  return (
    <div className="card space-y-3">
      <h2 className="text-sm font-bold text-leaf-600 uppercase">Question</h2>
      <p className="text-lg font-semibold">{props.question}</p>
      {props.correct === true && <p className="font-bold text-leaf-700">✅ Correct! +{props.points} points</p>}
      {props.correct === false && <p className="font-bold text-petal">Out of tries. The stamp still counts.</p>}
      {!finished && (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!answer.trim()) return
            setBusy(true)
            setMsg(await props.onAnswer(answer.trim()))
            setBusy(false)
            setAnswer('')
          }}
        >
          <input className="field" placeholder="Your answer" value={answer} onChange={(e) => setAnswer(e.target.value)}
            autoComplete="off" enterKeyHint="send" />
          <button className="btn-primary" disabled={busy || !answer.trim()}>
            {busy ? 'Checking…' : `Submit answer (${left} ${left === 1 ? 'try' : 'tries'} left)`}
          </button>
        </form>
      )}
      {msg && props.correct === null && (
        <p className={`font-semibold ${msg.tone === 'error' ? 'text-petal' : msg.tone === 'warn' ? 'text-amber-700' : 'text-leaf-700'}`}>
          {msg.text}
        </p>
      )}
    </div>
  )
}
