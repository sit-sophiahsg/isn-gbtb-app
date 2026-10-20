import { useSyncStatus } from '../lib/sync'

/** "Saved on phone / synced" indicator shown at the top of the passport. */
export function SyncPill() {
  const { pending, syncing, online } = useSyncStatus()

  let text: string
  let detail: string | null = null
  let tone: 'ok' | 'busy' | 'wait'
  if (pending === 0) {
    text = 'All synced'
    tone = 'ok'
  } else if (syncing) {
    text = `Syncing ${pending}…`
    tone = 'busy'
  } else {
    text = `${pending} saved on phone`
    detail = online ? 'Retrying shortly' : 'No signal: open the app again later to sync'
    tone = 'wait'
  }

  const colours = {
    ok: 'bg-ok/12 text-ok border-ok/30',
    busy: 'bg-gold/15 text-ink border-gold/40',
    wait: 'bg-warn/12 text-warn border-warn/35',
  }[tone]

  return (
    <div role="status" aria-live="polite" className={`inline-flex flex-col rounded-2xl border px-3 py-1.5 ${colours}`}>
      <span className="flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold">
        <span aria-hidden="true">{tone === 'ok' ? '✓' : tone === 'busy' ? '↻' : '●'}</span>
        {text}
      </span>
      {detail && <span className="text-xs">{detail}</span>}
    </div>
  )
}
