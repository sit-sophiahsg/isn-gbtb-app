import { Link } from 'react-router'
import { useRally, type CheckpointState } from '../lib/data'
import { Countdown, useNow } from '../components/Countdown'

export function useRallyOpen() {
  const { event } = useRally()
  const now = useNow(5000)
  const started = Boolean(event?.rally_started_at)
  const timeUp = Boolean(event?.rally_ends_at && new Date(event.rally_ends_at).getTime() <= now)
  return { started, timeUp, open: started && !timeUp }
}

export function Badge({ state }: { state: CheckpointState }) {
  switch (state.kind) {
    case 'stamped':
      return <span className="stamp-in grid size-14 shrink-0 place-items-center rounded-full border-4 border-leaf-600 bg-leaf-50 text-2xl" aria-label="Stamped">🌸</span>
    case 'pending':
      return <span className="stamp-in grid size-14 shrink-0 place-items-center rounded-full border-4 border-dashed border-leaf-500 bg-leaf-50 text-2xl" aria-label="Stamped, syncing">🌸</span>
    case 'rejected':
      return <span className="grid size-14 shrink-0 place-items-center rounded-full border-4 border-petal bg-petal/10 text-2xl" aria-label="Rejected">↺</span>
    default:
      return <span className="size-14 shrink-0 rounded-full border-4 border-dashed border-leaf-200" aria-label="Not yet" />
  }
}

export function StampCardPage() {
  const { event, checkpoints, stateOf, pending } = useRally()
  const { started, timeUp } = useRallyOpen()
  const states = checkpoints.map((c) => stateOf(c.id))
  const done = states.filter((s) => s.kind === 'stamped' || s.kind === 'pending').length
  const allDone = checkpoints.length > 0 && done === checkpoints.length
  const hasQr = checkpoints.some((c) => c.method === 'qr')
  const queuedScans = pending.filter((p) => p.kind === 'qr').length

  return (
    <div className="page space-y-4">
      <div className="card flex items-center gap-4">
        <div className="text-5xl font-black text-leaf-700 tabular-nums">
          {done}<span className="text-2xl text-leaf-900/40">/{checkpoints.length}</span>
        </div>
        <div className="flex-1">
          <div className="text-lg font-extrabold">stamps collected</div>
          <div className="text-leaf-900/70">
            {!started ? 'Rally starts soon' : event?.rally_ends_at ? <Countdown endsAt={event.rally_ends_at} /> : 'Rally in progress'}
          </div>
        </div>
      </div>

      {(allDone || timeUp) && (
        <div className="rounded-3xl bg-sun p-5 text-ink shadow-sm">
          <div className="text-xl font-extrabold">{allDone ? '🎉 All stamps collected!' : "⏰ Time's up!"}</div>
          <p className="mt-1">Head back with your group to:</p>
          <p className="mt-1 text-lg font-extrabold">{event?.meeting_point || 'the meeting point'}</p>
        </div>
      )}

      {!started && (
        <p className="rounded-2xl bg-leaf-100 p-4 font-semibold text-leaf-900">
          You can look at the checkpoints now. Stamps unlock when the rally starts.
        </p>
      )}

      {queuedScans > 0 && (
        <p className="rounded-2xl bg-leaf-100 p-4 font-semibold text-leaf-900">
          {queuedScans} QR scan{queuedScans > 1 ? 's' : ''} saved. It will appear on your card when you have signal.
        </p>
      )}

      <ol className="space-y-3">
        {checkpoints.map((c, i) => {
          const s = states[i]
          return (
            <li key={c.id}>
              <Link to={`/checkpoint/${c.id}`} className="card flex min-h-20 items-center gap-4 active:bg-leaf-50">
                <Badge state={s} />
                <div className="min-w-0 flex-1">
                  <div className="text-lg leading-snug font-extrabold">{c.name}</div>
                  <div className="text-sm text-leaf-900/70">
                    {s.kind === 'rejected' ? (
                      <span className="font-bold text-petal">Not accepted. Tap to redo</span>
                    ) : s.kind === 'pending' ? (
                      'Stamped · uploading when signal returns'
                    ) : s.kind === 'stamped' ? (
                      c.question && s.stamp.question_correct === null ? 'Stamped · question to answer' : 'Stamped'
                    ) : (
                      <>{c.method === 'qr' ? '📷 Scan QR' : '📸 Photo task'}{c.question ? ' + question' : ''}</>
                    )}
                  </div>
                </div>
                <span className="text-2xl text-leaf-900/30" aria-hidden>›</span>
              </Link>
            </li>
          )
        })}
      </ol>

      {hasQr && started && !timeUp && (
        <div className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-cream via-cream to-transparent px-4 pt-6" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <div className="mx-auto max-w-lg">
            <Link to="/scan" className="btn-primary text-xl">📷 Scan checkpoint QR</Link>
          </div>
        </div>
      )}
    </div>
  )
}
