// Background upload of submissions saved on the phone. iPhones can't sync in the background,
// so this runs whenever the app is open: on launch, when signal returns, when the app is
// brought back to the front, and every 20 seconds.
import { useSyncExternalStore } from 'react'
import { api } from './api'
import { getPendingSubmissions, markSynced } from './localDb'

export interface SyncStatus {
  pending: number
  syncing: boolean
  online: boolean
}

let status: SyncStatus = { pending: 0, syncing: false, online: navigator.onLine }
const listeners = new Set<() => void>()
const afterSync = new Set<() => void>()
let running: Promise<void> | null = null
let started = false

function set(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch }
  listeners.forEach((l) => l())
}

export function syncNow(): Promise<void> {
  running ??= run().finally(() => {
    running = null
  })
  return running
}

async function run() {
  let pending = await getPendingSubmissions()
  set({ pending: pending.length, online: navigator.onLine })
  if (!pending.length || !navigator.onLine) return
  set({ syncing: true })
  try {
    for (const sub of pending) {
      try {
        await api.pushSubmission(sub)
        await markSynced(sub.id, sub.updatedAt)
      } catch {
        break // Most likely lost signal; the next trigger retries from where we stopped.
      }
    }
  } finally {
    pending = await getPendingSubmissions()
    set({ pending: pending.length, syncing: false, online: navigator.onLine })
    afterSync.forEach((l) => l())
  }
}

export function startSync() {
  if (started) return
  started = true
  window.addEventListener('online', () => void syncNow())
  window.addEventListener('offline', () => set({ online: false }))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow()
  })
  setInterval(() => void syncNow(), 20_000)
  void syncNow()
}

/** Called after each sync attempt, so screens can refresh their "synced" ticks. */
export function onSyncFinished(fn: () => void): () => void {
  afterSync.add(fn)
  return () => afterSync.delete(fn)
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => status,
  )
}
