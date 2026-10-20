import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { supabase } from '../lib/supabase'
import { setSession, takePendingQr } from '../lib/session'
import { submit } from '../lib/outbox'
import { useRally } from '../lib/data'
import { describeOutcome } from '../lib/messages'
import { Scanner, parseQr } from '../components/Scanner'
import { toast } from '../components/toast'

type JoinResult =
  | { status: 'ok'; group_id: string; join_token: string; name: string; emoji: string; leader_name: string }
  | { status: 'invalid' }

async function joinGroup(codeOrToken: string): Promise<JoinResult | 'offline'> {
  const { data, error } = await supabase.rpc('join_group', { p_code: codeOrToken })
  if (error) return 'offline'
  return data as JoinResult
}

/** After joining: save the session and redeem any checkpoint QR scanned earlier. */
function useFinishJoin() {
  const navigate = useNavigate()
  const { checkpoints } = useRally()
  return async (r: Extract<JoinResult, { status: 'ok' }>) => {
    setSession({ groupId: r.group_id, joinToken: r.join_token, name: r.name, emoji: r.emoji, leaderName: r.leader_name })
    const qr = takePendingQr()
    if (qr) {
      const o = await submit({ kind: 'qr', qrToken: qr, groupId: r.group_id, joinToken: r.join_token })
      if (o.type !== 'queued') {
        const m = describeOutcome(o, checkpoints)
        if (m) toast(m.text, m.tone)
      }
    }
    navigate('/group?welcome=1', { replace: true })
  }
}

export function JoinPage() {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const finish = useFinishJoin()
  const handled = useRef(false)

  async function attempt(value: string) {
    setBusy(true)
    setError(null)
    const r = await joinGroup(value)
    setBusy(false)
    if (r === 'offline') setError('No connection. Move to a spot with signal and try again.')
    else if (r.status === 'invalid') setError("That code wasn't found. Check it with your EXCO leader.")
    else await finish(r)
  }

  function onScan(text: string) {
    if (handled.current) return
    const p = parseQr(text)
    if (p?.type === 'group') {
      handled.current = true
      setScanning(false)
      void attempt(p.token).finally(() => { handled.current = false })
    } else {
      setError("That's not a group QR code. Ask your EXCO leader for your group's QR.")
    }
  }

  return (
    <div className="page space-y-5">
      <div className="pt-2 text-center">
        <div className="text-5xl" aria-hidden>🌱</div>
        <h1 className="mt-2 text-3xl font-extrabold text-leaf-800">Join your group</h1>
        <p className="mt-1 text-leaf-900/80">Your EXCO leader has your group code or QR.</p>
      </div>

      {scanning ? (
        <div className="space-y-3">
          <Scanner onResult={onScan} />
          <button className="btn-secondary" onClick={() => setScanning(false)}>Type a code instead</button>
        </div>
      ) : (
        <>
          <form
            className="card space-y-3"
            onSubmit={(e) => { e.preventDefault(); if (code.trim()) void attempt(code) }}
          >
            <label className="label" htmlFor="code">Group code</label>
            <input
              id="code"
              className="field text-center font-mono text-2xl tracking-widest uppercase"
              placeholder="FERN-01"
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button className="btn-primary" disabled={busy || !code.trim()}>
              {busy ? 'Joining…' : 'Join group'}
            </button>
          </form>
          <div className="text-center text-sm font-bold text-leaf-800/70 uppercase">or</div>
          <button className="btn-secondary" onClick={() => { setError(null); setScanning(true) }}>
            📷 Scan group QR
          </button>
        </>
      )}

      {error && <p role="alert" className="rounded-2xl bg-petal/10 p-4 font-semibold text-petal">{error}</p>}
    </div>
  )
}

/** /join/:token: opened from a group QR with the phone's own camera. */
export function JoinTokenPage() {
  const { token = '' } = useParams()
  const finish = useFinishJoin()
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    void joinGroup(token).then((r) => {
      if (r === 'offline') setError('No connection. Move to a spot with signal, then reload this page.')
      else if (r.status === 'invalid') setError("This group QR isn't valid. Ask your EXCO leader.")
      else void finish(r)
    })
  }, [token, finish])

  return (
    <div className="page pt-16 text-center">
      {error ? (
        <>
          <p className="text-xl font-bold text-petal">{error}</p>
          <button className="btn-primary mt-6" onClick={() => location.reload()}>Try again</button>
        </>
      ) : (
        <p className="text-xl font-bold text-leaf-800">Joining your group…</p>
      )}
    </div>
  )
}
