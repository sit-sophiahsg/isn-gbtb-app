import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { supabase } from '../lib/supabase'
import { useRally } from '../lib/data'
import { setSession } from '../lib/session'
import { clearForGroup } from '../lib/outbox'
import { toast } from '../components/toast'

export function GroupPage() {
  const { session, pending } = useRally()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPin, setShowPin] = useState(false)

  if (!session) return null
  const s = session

  async function unlockLeader() {
    setBusy(true)
    const { data, error } = await supabase.rpc('verify_leader_pin', { p_group_token: s.joinToken, p_pin: pin })
    setBusy(false)
    if (error) return toast('No connection. Try again where there is signal.', 'warn')
    if (!data) return toast('Wrong PIN.', 'error')
    setSession({ ...s, leaderPin: pin.trim() })
    setPin('')
    setShowPin(false)
    toast('Leader mode on. You can now give manual stamps.')
  }

  async function leave() {
    const warn = pending.length ? `\n\n${pending.length} item(s) haven't uploaded yet and will be lost.` : ''
    if (!confirm(`Leave ${s.name}?${warn}`)) return
    await clearForGroup(s.groupId)
    setSession(null)
    navigate('/', { replace: true })
  }

  return (
    <div className="page space-y-5">
      <div className="card text-center">
        {params.get('welcome') && <p className="font-bold text-leaf-600">You're in! 🎉</p>}
        <div className="mt-1 text-6xl" aria-hidden>{s.emoji}</div>
        <h1 className="mt-2 text-3xl font-extrabold text-leaf-800">{s.name}</h1>
        <p className="mt-2 text-lg">
          Your EXCO leader: <strong>{s.leaderName || '-'}</strong>
        </p>
      </div>

      <Link to="/" className="btn-primary">Go to stamp card</Link>

      <div className="card space-y-3">
        <h2 className="text-lg font-extrabold">EXCO leader</h2>
        {s.leaderPin ? (
          <>
            <p>Leader mode is on. Open any checkpoint to give a manual stamp if a QR or photo upload fails.</p>
            <button className="btn-secondary" onClick={() => setSession({ ...s, leaderPin: undefined })}>
              Turn off leader mode
            </button>
          </>
        ) : showPin ? (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void unlockLeader() }}>
            <label className="label" htmlFor="pin">Leader PIN</label>
            <input
              id="pin"
              className="field text-center font-mono text-2xl tracking-[0.4em]"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            />
            <button className="btn-primary" disabled={busy || pin.length < 6}>{busy ? 'Checking…' : 'Unlock leader mode'}</button>
          </form>
        ) : (
          <button className="btn-secondary" onClick={() => setShowPin(true)}>I'm the EXCO leader</button>
        )}
      </div>

      <button className="btn-ghost" onClick={() => void leave()}>Leave this group</button>
    </div>
  )
}
