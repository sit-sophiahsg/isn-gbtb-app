// Everything a student does is saved here first, so it survives patchy signal inside the dome.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { EventInfo, Student, Submission } from './types'

interface Session {
  event: EventInfo
  student: Student
}

interface PhoneDB extends DBSchema {
  kv: { key: string; value: unknown }
  submissions: { key: string; value: Submission; indexes: { byStudent: string } }
}

let dbPromise: Promise<IDBPDatabase<PhoneDB>> | null = null

function db() {
  dbPromise ??= openDB<PhoneDB>('postcards-phone', 1, {
    upgrade(d) {
      d.createObjectStore('kv')
      d.createObjectStore('submissions', { keyPath: 'id' }).createIndex('byStudent', 'studentId')
    },
  })
  return dbPromise
}

export async function getSession(): Promise<Session | null> {
  return ((await (await db()).get('kv', 'session')) as Session | undefined) ?? null
}

export async function setSession(session: Session | null): Promise<void> {
  const d = await db()
  if (session) await d.put('kv', session, 'session')
  else await d.delete('kv', 'session')
}

export async function getSubmissions(studentId: string): Promise<Submission[]> {
  return (await db()).getAllFromIndex('submissions', 'byStudent', studentId)
}

export async function getPendingSubmissions(): Promise<Submission[]> {
  return (await (await db()).getAll('submissions')).filter((s) => s.sync === 'pending')
}

export async function putSubmission(sub: Submission): Promise<void> {
  await (await db()).put('submissions', sub)
}

/** Replace this student's local copies with the server's, keeping anything not yet uploaded. */
export async function mergeServerSubmissions(studentId: string, server: Submission[]): Promise<void> {
  const d = await db()
  const local = await d.getAllFromIndex('submissions', 'byStudent', studentId)
  const pendingKeys = new Set(local.filter((s) => s.sync === 'pending').map((s) => s.stampKey))
  const tx = d.transaction('submissions', 'readwrite')
  for (const s of local) if (!pendingKeys.has(s.stampKey)) await tx.store.delete(s.id)
  for (const s of server) if (!pendingKeys.has(s.stampKey)) await tx.store.put({ ...s, sync: 'synced' })
  await tx.done
}

export async function markSynced(id: string, updatedAt: string): Promise<void> {
  const d = await db()
  const sub = await d.get('submissions', id)
  // Only mark synced if it hasn't been edited again since this upload started.
  if (sub && sub.updatedAt === updatedAt) await d.put('submissions', { ...sub, sync: 'synced' })
}

/** Used by "This isn't me / leave this phone". Unsynced work stays queued and still uploads. */
export async function clearSyncedForStudent(studentId: string): Promise<void> {
  const d = await db()
  const local = await d.getAllFromIndex('submissions', 'byStudent', studentId)
  const tx = d.transaction('submissions', 'readwrite')
  for (const s of local) if (s.sync === 'synced') await tx.store.delete(s.id)
  await tx.done
}

export interface Draft {
  photo: Blob | null
  reflection: string
}

/** Unfinished activity, kept in case the phone reloads the page while the camera is open. */
export async function getDraft(studentId: string, stampKey: string): Promise<Draft | null> {
  return ((await (await db()).get('kv', `draft:${studentId}:${stampKey}`)) as Draft | undefined) ?? null
}

export async function setDraft(studentId: string, stampKey: string, draft: Draft | null): Promise<void> {
  const d = await db()
  if (draft) await d.put('kv', draft, `draft:${studentId}:${stampKey}`)
  else await d.delete('kv', `draft:${studentId}:${stampKey}`)
}
