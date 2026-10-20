// App-wide live data: event settings, groups, checkpoints and this group's
// stamps. Loaded from Supabase, kept fresh with Realtime, and mirrored to
// localStorage so the app still opens with no signal.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase, configured } from './supabase'
import { readCache, writeCache } from './cache'
import { getSession, onSessionChange, setSession, type GroupSession } from './session'
import { getPending, onOutcome, onPendingChange, type PendingInfo } from './outbox'
import type { Checkpoint, EventRow, Group, Stamp } from './types'

export type CheckpointState =
  | { kind: 'todo' }
  | { kind: 'pending' }                 // queued on this phone, not yet synced
  | { kind: 'stamped'; stamp: Stamp }
  | { kind: 'rejected'; stamp: Stamp }

interface RallyData {
  ready: boolean
  online: boolean
  event: EventRow | null
  groups: Group[]
  checkpoints: Checkpoint[]          // active only, in order
  stamps: Stamp[]                    // this group's
  pending: PendingInfo[]
  session: GroupSession | null
  stateOf: (checkpointId: string) => CheckpointState
  refresh: () => Promise<void>
}

const Ctx = createContext<RallyData | null>(null)

export function useRally() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useRally outside RallyProvider')
  return v
}

export function RallyProvider({ children }: { children: ReactNode }) {
  const [session, setSess] = useState(getSession)
  const [event, setEvent] = useState<EventRow | null>(() => readCache('event') ?? null)
  const [groups, setGroups] = useState<Group[]>(() => readCache('groups') ?? [])
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>(() => readCache('checkpoints') ?? [])
  const [stamps, setStamps] = useState<Stamp[]>(() => readCache('stamps') ?? [])
  const [pending, setPending] = useState(getPending)
  const [online, setOnline] = useState(() => navigator.onLine)
  const [ready, setReady] = useState(() => readCache('event') !== undefined)

  const groupId = session?.groupId

  useEffect(() => onSessionChange(() => setSess(getSession())), [])
  useEffect(() => onPendingChange(setPending), [])
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])

  const loadStamps = useCallback(async () => {
    if (!groupId) { setStamps([]); return }
    const { data, error } = await supabase.from('stamps').select('*').eq('group_id', groupId)
    if (!error && data) { setStamps(data as Stamp[]); writeCache('stamps', data) }
  }, [groupId])

  const refresh = useCallback(async () => {
    if (!configured) return
    const [e, g, c] = await Promise.all([
      supabase.from('event').select('*').eq('id', 1).maybeSingle(),
      supabase.from('groups').select('*').order('sort_order'),
      supabase.from('checkpoints').select('*').eq('active', true).order('sort_order'),
    ])
    if (e.data) { setEvent(e.data as EventRow); writeCache('event', e.data) }
    if (g.data) { setGroups(g.data as Group[]); writeCache('groups', g.data) }
    if (c.data) { setCheckpoints(c.data as Checkpoint[]); writeCache('checkpoints', c.data) }
    await loadStamps()
    if (!e.error) setReady(true)
  }, [loadStamps])

  // A joined group that no longer exists (e.g. data was reset): forget it.
  useEffect(() => {
    if (ready && groupId && groups.length && !groups.some((g) => g.id === groupId)) setSession(null)
  }, [ready, groupId, groups])

  // Initial load + realtime. Any change simply triggers a refetch of that
  // table: the data is tiny and it keeps the logic simple and correct.
  useEffect(() => {
    void refresh()
    if (!configured) return
    const ch = supabase
      .channel('rally-' + (groupId ?? 'none'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event' }, (p) => {
        if (p.new && 'id' in p.new) { setEvent(p.new as EventRow); writeCache('event', p.new) }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checkpoints' }, () => void refresh())
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stamps', ...(groupId ? { filter: `group_id=eq.${groupId}` } : {}) },
        () => void loadStamps(),
      )
      .subscribe((status) => {
        // Catch up on anything missed while disconnected.
        if (status === 'SUBSCRIBED') void refresh()
      })
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    return () => {
      void supabase.removeChannel(ch)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
    }
  }, [groupId, refresh, loadStamps])

  // When a queued item lands, pull the authoritative stamp rows.
  useEffect(() => onOutcome(() => void loadStamps()), [loadStamps])

  const stateOf = useCallback(
    (checkpointId: string): CheckpointState => {
      const s = stamps.find((x) => x.checkpoint_id === checkpointId)
      const queued = pending.some(
        (p) => p.checkpointId === checkpointId && (p.kind === 'photo' || p.kind === 'manual'),
      )
      if (s?.status === 'ok') return { kind: 'stamped', stamp: s }
      // Photo stamps count as soon as they're queued, so a weak signal never blocks a group.
      if (queued) return { kind: 'pending' }
      if (s?.status === 'rejected') return { kind: 'rejected', stamp: s }
      return { kind: 'todo' }
    },
    [stamps, pending],
  )

  const value = useMemo<RallyData>(
    () => ({
      ready, online, event, groups,
      checkpoints: checkpoints.filter((c) => c.active),
      stamps: stamps.filter((s) => s.group_id === groupId),
      pending, session, stateOf, refresh,
    }),
    [ready, online, event, groups, checkpoints, stamps, groupId, pending, session, stateOf, refresh],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
