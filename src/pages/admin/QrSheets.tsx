import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { supabase } from '../../lib/supabase'
import type { Checkpoint, EventRow, Group } from '../../lib/types'

type Sheet = 'checkpoints' | 'groups' | 'leaders'

interface GroupWithSecrets extends Group { join_code: string; join_token: string; leader_pin: string }
interface CheckpointWithToken extends Checkpoint { qr_token: string }

function QrImage({ text, size = 280 }: { text: string; size?: number }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    void QRCode.toDataURL(text, { width: size * 2, margin: 1, errorCorrectionLevel: 'M' }).then(setSrc)
  }, [text, size])
  return src ? <img src={src} width={size} height={size} alt="" className="mx-auto" /> : <div style={{ width: size, height: size }} />
}

export function QrSheets() {
  const [sheet, setSheet] = useState<Sheet>('checkpoints')
  const [event, setEvent] = useState<EventRow | null>(null)
  const [groups, setGroups] = useState<GroupWithSecrets[]>([])
  const [cps, setCps] = useState<CheckpointWithToken[]>([])
  const [error, setError] = useState<string | null>(null)
  const origin = window.location.origin
  const isLocal = /localhost|127\.0\.0\.1|192\.168\.|10\.\d+\./.test(origin)

  useEffect(() => {
    void (async () => {
      const [e, g, gs, c, cs] = await Promise.all([
        supabase.from('event').select('*').eq('id', 1).single(),
        supabase.from('groups').select('*').order('sort_order'),
        supabase.from('group_secrets').select('*'),
        supabase.from('checkpoints').select('*').eq('active', true).order('sort_order'),
        supabase.from('checkpoint_secrets').select('checkpoint_id, qr_token'),
      ])
      const err = [e, g, gs, c, cs].find((r) => r.error)?.error
      if (err) return setError(err.message)
      setEvent(e.data as EventRow)
      setGroups((g.data as Group[]).map((x) => ({ ...x, ...(gs.data ?? []).find((s) => s.group_id === x.id) })) as GroupWithSecrets[])
      setCps((c.data as Checkpoint[]).map((x) => ({ ...x, qr_token: (cs.data ?? []).find((s) => s.checkpoint_id === x.id)?.qr_token })) as CheckpointWithToken[])
    })()
  }, [])

  const qrCps = cps.filter((c) => c.method === 'qr')
  const tabs: [Sheet, string][] = [['checkpoints', 'Checkpoint QRs'], ['groups', 'Group QRs'], ['leaders', 'Leaders sheet (PINs)']]

  return (
    <div className="mx-auto max-w-5xl p-4">
      <div className="no-print space-y-4 pb-6">
        <h1 className="text-2xl font-extrabold">Print QR codes</h1>
        {isLocal && (
          <p className="rounded-2xl bg-sun p-4 font-semibold">
            These QR codes point to {origin}. That's fine for testing, but for the real event print them from your
            deployed site (e.g. https://your-app.vercel.app/admin/qr).
          </p>
        )}
        {error && <p className="font-semibold text-petal">{error}</p>}
        <div className="flex flex-wrap gap-2">
          {tabs.map(([k, label]) => (
            <button key={k} onClick={() => setSheet(k)}
              className={`rounded-full px-4 py-2 font-bold ${sheet === k ? 'bg-leaf-700 text-white' : 'bg-white ring-1 ring-leaf-900/15'}`}>
              {label}
            </button>
          ))}
        </div>
        <p className="text-leaf-900/80">
          {sheet === 'checkpoints' && 'One page per QR checkpoint. Photo checkpoints need no QR, so they are not listed.'}
          {sheet === 'groups' && 'One page per group, for participants to scan to join. Contains no leader PINs.'}
          {sheet === 'leaders' && 'Leaders only: do NOT show this to participants. Cut into strips and give one to each EXCO leader.'}
        </p>
        <button className="btn-primary sm:w-auto" onClick={() => window.print()}>🖨 Print this sheet</button>
      </div>

      {sheet === 'checkpoints' && (
        qrCps.length === 0
          ? <p className="card">No checkpoints use the QR method. Change a checkpoint's method to "qr" to print one.</p>
          : qrCps.map((c) => (
            <section key={c.id} className="print-page flex min-h-[90vh] flex-col items-center justify-center gap-6 py-10 text-center">
              <div className="text-xl font-bold text-leaf-700">{event?.name}</div>
              <div className="text-sm font-bold tracking-widest text-leaf-600 uppercase">Checkpoint {c.sort_order}</div>
              <h2 className="text-5xl font-black">{c.name}</h2>
              <QrImage text={`${origin}/s/${c.qr_token}`} size={340} />
              <p className="text-2xl font-bold">Scan with the Stamp Rally app to collect your stamp 🌸</p>
            </section>
          ))
      )}

      {sheet === 'groups' && groups.map((g) => (
        <section key={g.id} className="print-page flex min-h-[90vh] flex-col items-center justify-center gap-5 py-10 text-center">
          <div className="text-xl font-bold text-leaf-700">{event?.name}</div>
          <div className="text-7xl">{g.emoji}</div>
          <h2 className="text-5xl font-black">{g.name}</h2>
          <p className="text-2xl">EXCO leader: <strong>{g.leader_name}</strong></p>
          <QrImage text={`${origin}/join/${g.join_token}`} size={300} />
          <p className="text-xl">Scan with your phone camera, or go to <strong>{origin.replace(/^https?:\/\//, '')}</strong> and enter:</p>
          <p className="font-mono text-5xl font-black tracking-widest">{g.join_code}</p>
        </section>
      ))}

      {sheet === 'leaders' && (
        <div className="space-y-0">
          <p className="mb-4 hidden text-center text-xl font-black print:block">LEADERS ONLY: keep this private</p>
          {groups.map((g) => (
            <div key={g.id} className="flex items-center gap-6 border-b-2 border-dashed border-leaf-900/30 py-6 break-inside-avoid">
              <div className="text-5xl">{g.emoji}</div>
              <div className="flex-1">
                <div className="text-2xl font-black">{g.name}</div>
                <div className="text-lg">Leader: {g.leader_name}</div>
                <div className="text-lg">Join code: <span className="font-mono font-bold">{g.join_code}</span></div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold uppercase">Leader PIN</div>
                <div className="font-mono text-4xl font-black tracking-widest">{g.leader_pin}</div>
              </div>
            </div>
          ))}
          <p className="pt-4 text-sm text-leaf-900/70">
            To unlock leader mode: open the app, tap your group name at the top, then "I'm the EXCO leader", and enter the PIN.
          </p>
        </div>
      )}
    </div>
  )
}
