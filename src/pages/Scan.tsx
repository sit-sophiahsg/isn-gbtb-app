import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { useRally } from '../lib/data'
import { submit, type Outcome, type PendingInfo } from '../lib/outbox'
import { describeOutcome, type Tone } from '../lib/messages'
import { setPendingQr } from '../lib/session'
import { Scanner, parseQr } from '../components/Scanner'

type Result = { text: string; tone: Tone; checkpointId?: string }

function useClaim() {
  const { session, checkpoints } = useRally()
  return async (qrToken: string): Promise<Result> => {
    if (!session) return { text: 'Join a group first.', tone: 'warn' }
    const o: Outcome | { type: 'queued'; item: PendingInfo } = await submit({
      kind: 'qr', qrToken, groupId: session.groupId, joinToken: session.joinToken,
    })
    if (o.type === 'queued') return { text: "No signal right now. Scan saved: it will count when you're back online.", tone: 'ok' }
    const m = describeOutcome(o, checkpoints) ?? { text: 'Done.', tone: 'ok' as Tone }
    return { ...m, checkpointId: o.result?.checkpoint_id as string | undefined }
  }
}

function ResultCard({ result, onAgain }: { result: Result; onAgain?: () => void }) {
  const icon = result.tone === 'ok' ? '🌸' : result.tone === 'warn' ? '⚠️' : '✋'
  return (
    <div className="card space-y-4 text-center">
      <div className={`text-6xl ${result.tone === 'ok' ? 'stamp-in' : ''}`} aria-hidden>{icon}</div>
      <p className="text-xl font-extrabold">{result.text}</p>
      {result.checkpointId && (
        <Link to={`/checkpoint/${result.checkpointId}`} replace className="btn-primary">Open checkpoint</Link>
      )}
      <Link to="/" replace className={result.checkpointId ? 'btn-secondary' : 'btn-primary'}>Back to stamp card</Link>
      {onAgain && <button className="btn-ghost" onClick={onAgain}>Scan another</button>}
    </div>
  )
}

/** /scan: in-app camera scanner. */
export function ScanPage() {
  const claim = useClaim()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const lock = useRef(false)

  async function onScan(text: string) {
    if (lock.current) return
    const p = parseQr(text)
    if (!p) { setHint("That QR code isn't part of the rally."); return }
    if (p.type === 'group') { setHint("That's a group QR. Scan the checkpoint's QR instead."); return }
    lock.current = true
    setBusy(true)
    navigator.vibrate?.(60)
    setResult(await claim(p.token))
    setBusy(false)
  }

  return (
    <div className="page space-y-4">
      <button onClick={() => navigate(-1)} className="py-2 font-bold text-leaf-700">‹ Back</button>
      {result ? (
        <ResultCard result={result} onAgain={() => { setResult(null); setHint(null); lock.current = false }} />
      ) : (
        <>
          <h1 className="text-2xl font-extrabold">Scan the checkpoint QR</h1>
          <Scanner onResult={(t) => void onScan(t)} paused={busy} />
          <p className="text-center font-semibold text-leaf-900/80">
            {busy ? 'Checking…' : hint ?? 'Hold the camera steady over the QR code.'}
          </p>
        </>
      )}
    </div>
  )
}

/** /s/:token: a checkpoint QR opened with the phone's own camera app. */
export function ScanLandingPage() {
  const { token = '' } = useParams()
  const { session } = useRally()
  const claim = useClaim()
  const [result, setResult] = useState<Result | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (!session || started.current) return
    started.current = true
    void claim(token.toLowerCase()).then(setResult)
  }, [session, token, claim])

  if (!session) {
    // Remember the scan and redeem it right after joining. (Navigate runs in an
    // effect, so this store happens before the join screen mounts.)
    setPendingQr(token.toLowerCase())
    return <Navigate to="/" replace />
  }
  return (
    <div className="page pt-6">
      {result ? <ResultCard result={result} /> : <p className="pt-10 text-center text-xl font-bold">Collecting stamp…</p>}
    </div>
  )
}
