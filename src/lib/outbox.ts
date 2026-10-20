// Offline outbox.
//
// Every participant write (QR stamp, photo, leader stamp, quiz answer) is put
// in a queue in IndexedDB first, then sent in order. If the network drops the
// item stays queued and is retried when signal returns (online event, app
// coming back to the foreground, or a backoff timer). Each item carries a
// client-generated id and the server treats repeats as no-ops, so a request
// that succeeded but whose response got lost is safe to resend.

import { createStore, get, set, del, keys } from 'idb-keyval'
import { supabase } from './supabase'

interface Base {
  id: string
  createdAt: string
  groupId: string
  joinToken: string
}

export type OutboxItem = Base &
  (
    | { kind: 'qr'; qrToken: string }
    | { kind: 'photo'; checkpointId: string | null; path: string; caption: string
        data: ArrayBuffer; type: string; uploaded?: boolean }
    | { kind: 'manual'; checkpointId: string; pin: string }
    | { kind: 'answer'; checkpointId: string; answer: string }
  )

/** Distributes Omit over the union so each variant keeps its own fields. */
type NewItem = OutboxItem extends infer T ? (T extends OutboxItem ? Omit<T, 'id' | 'createdAt'> : never) : never

/** What the UI needs to know about queued work (no photo bytes). */
export interface PendingInfo {
  id: string
  kind: OutboxItem['kind']
  checkpointId: string | null
  createdAt: string
}

export type ServerResult = Record<string, unknown> & { status: string }

export interface Outcome {
  item: PendingInfo
  /** 'done': the server answered. 'failed': the server refused it for good. */
  type: 'done' | 'failed'
  result?: ServerResult
  error?: string
  /** True when a screen was still waiting on submit() and shows the result itself. */
  awaited?: boolean
}

// --------------------------------------------------------------- storage ---

const store = (() => {
  try {
    return createStore('rally', 'outbox')
  } catch {
    return null
  }
})()
const memory = new Map<string, OutboxItem>() // fallback when IndexedDB is blocked

async function save(item: OutboxItem) {
  memory.set(item.id, item)
  if (store) await set(item.id, item, store).catch(() => {})
}

async function remove(id: string) {
  memory.delete(id)
  if (store) await del(id, store).catch(() => {})
}

async function loadAll(): Promise<OutboxItem[]> {
  if (store) {
    try {
      const ids = (await keys(store)) as string[]
      for (const id of ids) {
        if (!memory.has(id)) {
          const it = await get<OutboxItem>(id, store)
          if (it) memory.set(id, it)
        }
      }
    } catch { /* use memory */ }
  }
  return [...memory.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

// ------------------------------------------------------------ listeners ---

let pending: PendingInfo[] = []
const pendingListeners = new Set<(p: PendingInfo[]) => void>()
const outcomeListeners = new Set<(o: Outcome) => void>()
const waiters = new Map<string, (o: Outcome) => void>()

function info(it: OutboxItem): PendingInfo {
  return {
    id: it.id,
    kind: it.kind,
    checkpointId: 'checkpointId' in it ? it.checkpointId : null,
    createdAt: it.createdAt,
  }
}

async function refreshPending() {
  pending = (await loadAll()).map(info)
  pendingListeners.forEach((l) => l(pending))
}

export function getPending() {
  return pending
}

export function onPendingChange(fn: (p: PendingInfo[]) => void) {
  pendingListeners.add(fn)
  return () => { pendingListeners.delete(fn) }
}

/** Called for every finished item, including ones that synced in the background. */
export function onOutcome(fn: (o: Outcome) => void) {
  outcomeListeners.add(fn)
  return () => { outcomeListeners.delete(fn) }
}

// --------------------------------------------------------------- submit ---

export function newId(): string {
  // crypto.randomUUID only exists on HTTPS pages.
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/**
 * Queue an item and try to send it now. Resolves with the server's answer if
 * it arrives within `waitMs`, otherwise with 'queued' (it keeps trying).
 */
export async function submit(
  draft: NewItem,
  waitMs = 6000,
): Promise<Outcome | { type: 'queued'; item: PendingInfo }> {
  const item = { ...draft, id: newId(), createdAt: new Date().toISOString() } as OutboxItem
  await save(item)
  await refreshPending()

  const result = new Promise<Outcome>((resolve) => waiters.set(item.id, resolve))
  void flush()
  const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), waitMs))
  const first = await Promise.race([result, timeout])
  if (first === 'timeout') {
    waiters.delete(item.id) // the screen has moved on; report it in the background
    return { type: 'queued', item: info(item) }
  }
  return first
}

/** Drop everything queued for a group (used when leaving a group). */
export async function clearForGroup(groupId: string) {
  for (const it of await loadAll()) if (it.groupId === groupId) await remove(it.id)
  await refreshPending()
}

// ------------------------------------------------------------ processing ---

class Retry extends Error {}
class Permanent extends Error {}

function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Retry('timeout')), ms)
    Promise.resolve(p).then(
      (v) => { clearTimeout(t); resolve(v) },
      (e) => { clearTimeout(t); reject(e) },
    )
  })
}

async function rpc(fn: string, args: Record<string, unknown>): Promise<ServerResult> {
  const { data, error } = await withTimeout(supabase.rpc(fn, args), 20000)
  if (error) {
    // Postgres/PostgREST errors carry a code; network failures don't.
    if (error.code) throw new Permanent(error.message)
    throw new Retry(error.message)
  }
  return data as ServerResult
}

async function send(it: OutboxItem): Promise<ServerResult> {
  switch (it.kind) {
    case 'qr':
      return rpc('claim_qr_stamp', {
        p_group_token: it.joinToken, p_qr_token: it.qrToken, p_client_time: it.createdAt,
      })
    case 'manual':
      return rpc('leader_stamp', {
        p_group_token: it.joinToken, p_pin: it.pin, p_checkpoint_id: it.checkpointId,
        p_client_time: it.createdAt,
      })
    case 'answer':
      return rpc('answer_question', {
        p_group_token: it.joinToken, p_checkpoint_id: it.checkpointId, p_answer: it.answer,
        p_attempt_id: it.id,
      })
    case 'photo': {
      if (!it.uploaded) {
        const { error } = await withTimeout(
          supabase.storage.from('photos').upload(it.path, new Blob([it.data], { type: it.type }), {
            contentType: it.type, upsert: false, cacheControl: '31536000',
          }),
          60000,
        )
        if (error) {
          const status = Number((error as { statusCode?: string | number }).statusCode ?? 0)
          const exists = status === 409 || /exists|duplicate/i.test(error.message)
          // An earlier attempt got through but we lost the response: fine.
          if (!exists) {
            if (status >= 400 && status < 500) throw new Permanent(error.message)
            throw new Retry(error.message)
          }
        }
        it.uploaded = true
        await save(it)
      }
      return rpc('submit_photo', {
        p_group_token: it.joinToken, p_checkpoint_id: it.checkpointId, p_storage_path: it.path,
        p_caption: it.caption, p_client_time: it.createdAt,
      })
    }
  }
}

let running = false
let again = false
let retryTimer: ReturnType<typeof setTimeout> | undefined
let backoff = 3000

function finish(o: Outcome) {
  const waiter = waiters.get(o.item.id)
  waiters.delete(o.item.id)
  const full = { ...o, awaited: Boolean(waiter) }
  outcomeListeners.forEach((l) => l(full))
  waiter?.(full)
}

export async function flush() {
  if (running) { again = true; return }
  running = true
  again = false
  clearTimeout(retryTimer)
  retryTimer = undefined
  try {
    for (const it of await loadAll()) {
      try {
        const result = await send(it)
        await remove(it.id)
        finish({ item: info(it), type: 'done', result })
        backoff = 3000
      } catch (e) {
        if (e instanceof Permanent || !(e instanceof Retry || e instanceof TypeError)) {
          await remove(it.id)
          finish({ item: info(it), type: 'failed', error: (e as Error).message })
          continue
        }
        // Keep order: later items (e.g. an answer) may depend on this one.
        retryTimer = setTimeout(() => { retryTimer = undefined; void flush() }, backoff)
        backoff = Math.min(backoff * 2, 30000)
        break
      }
    }
  } finally {
    running = false
    await refreshPending()
  }
  if (again && !retryTimer) void flush()
}

// Retry triggers
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { backoff = 3000; void flush() })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void flush()
  })
  setInterval(() => { if (pending.length) void flush() }, 30000)
  void refreshPending().then(flush)
}
