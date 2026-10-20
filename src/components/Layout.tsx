import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useRally } from '../lib/data'
import { onOutcome } from '../lib/outbox'
import { describeOutcome } from '../lib/messages'
import { toast } from './toast'

/** Header with group + connection status; shows toasts for background syncs. */
export function Layout({ children }: { children: ReactNode }) {
  const { event, session, online, pending, checkpoints } = useRally()

  useEffect(
    () =>
      onOutcome((o) => {
        if (o.awaited) return
        const m = describeOutcome(o, checkpoints)
        if (m) toast(m.text, m.tone)
      }),
    [checkpoints],
  )

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 bg-leaf-700 text-white shadow-md" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <Link to="/" className="min-w-0 flex-1">
            <div className="truncate text-lg leading-tight font-extrabold">{event?.name ?? 'Stamp Rally'}</div>
            <div className="truncate text-sm text-leaf-100">{event?.club_name}</div>
          </Link>
          {session && (
            <Link to="/group" className="flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-sm font-bold">
              <span aria-hidden>{session.emoji}</span> {session.name}
              {session.leaderPin && <span className="ml-1 rounded-full bg-sun px-1.5 text-xs text-ink">LEADER</span>}
            </Link>
          )}
        </div>
        {(!online || pending.length > 0) && (
          <div className={`px-4 py-1.5 text-center text-sm font-bold ${online ? 'bg-sun text-ink' : 'bg-ink text-white'}`}>
            {!online ? 'No signal: keep going, everything is saved on your phone' : 'Syncing…'}
            {pending.length > 0 && ` · ${pending.length} waiting to upload`}
          </div>
        )}
      </header>
      <main>{children}</main>
    </div>
  )
}
