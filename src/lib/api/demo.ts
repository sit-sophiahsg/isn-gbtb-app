// In-browser stand-in for the Supabase backend (M1 only). It mirrors the rules the real
// `join_event` database function will enforce, so the app behaves the same once M2 lands.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { DEFAULT_SEASONAL, getStamps } from '../stamps'
import type { EventInfo, Student, Submission } from '../types'
import { nameKey } from '../validation'
import { OfflineError, type Api, type JoinInput } from './types'

const MAX_ATTEMPTS = 5
const LOCK_MS = 5 * 60 * 1000

interface StudentRow extends Student {
  nameKey: string
}
interface AttemptRow {
  failCount: number
  lockedUntil: number
}

interface ServerDB extends DBSchema {
  events: { key: string; value: EventInfo }
  students: { key: string; value: StudentRow }
  attempts: { key: string; value: AttemptRow }
  submissions: { key: string; value: Submission; indexes: { byStudent: string } }
}

const DEMO_EVENT: EventInfo = {
  id: 'demo-event',
  code: 'GBTB26',
  name: 'Postcards from Singapore · Christmas Train Show',
  eventDate: '2026-11-28',
  seasonalTitle: DEFAULT_SEASONAL.title,
  seasonalStampText: DEFAULT_SEASONAL.stampText,
  seasonalPrompt: DEFAULT_SEASONAL.prompt,
}

const SEED_STUDENTS: { studentId: string; firstName: string; country: string; stamps: number }[] = [
  { studentId: '2500001', firstName: 'Aisha', country: 'Malaysia', stamps: 2 },
  { studentId: '2500002', firstName: 'Lucas', country: 'Brazil', stamps: 5 },
]

const SEED_REFLECTIONS = [
  'Hibiscus everywhere back home! My grandmother grows them by the front door.',
  'Hawker centres and this mix of languages I hear on every train ride.',
  'Wei Ming taught me "shiok" and I taught him "saudade". We both want to try each other\'s street food.',
  'Christmas lights on Orchard Road remind me of the lights along Avenida Paulista.',
  'Looks just like Bayfront station! I ride the Downtown Line every morning.',
]

let dbPromise: Promise<IDBPDatabase<ServerDB>> | null = null

function db() {
  dbPromise ??= openDB<ServerDB>('postcards-demo-server', 1, {
    async upgrade(d, _old, _new, tx) {
      d.createObjectStore('events', { keyPath: 'code' })
      d.createObjectStore('students')
      d.createObjectStore('attempts')
      d.createObjectStore('submissions', { keyPath: 'id' }).createIndex('byStudent', 'studentId')
      await tx.objectStore('events').put(DEMO_EVENT)
    },
  }).then(async (d) => {
    await seedStudents(d)
    return d
  })
  return dbPromise
}

async function seedStudents(d: IDBPDatabase<ServerDB>) {
  const stamps = getStamps(DEMO_EVENT)
  for (const s of SEED_STUDENTS) {
    const key = `${DEMO_EVENT.id}:${s.studentId}`
    if (await d.get('students', key)) continue
    const row: StudentRow = {
      id: `demo-${s.studentId}`,
      eventId: DEMO_EVENT.id,
      studentId: s.studentId,
      firstName: s.firstName,
      country: s.country,
      nameKey: nameKey(s.firstName),
    }
    await d.put('students', row, key)
    for (let i = 0; i < s.stamps; i++) {
      const def = stamps[i]
      const photo = await placeholderPhoto(def.title, def.ink)
      const now = new Date().toISOString()
      await d.put('submissions', {
        id: `demo-${s.studentId}-${def.key}`,
        studentId: row.id,
        stampKey: def.key,
        photo,
        reflection: SEED_REFLECTIONS[i],
        createdAt: now,
        updatedAt: now,
        sync: 'synced',
      })
    }
  }
}

/** A simple painted card standing in for a real photo in the seeded demo data. */
async function placeholderPhoto(label: string, color: string): Promise<Blob> {
  const c = document.createElement('canvas')
  c.width = 1200
  c.height = 900
  const ctx = c.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 1200, 900)
  g.addColorStop(0, color)
  g.addColorStop(1, '#1d4a34')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 1200, 900)
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  for (let i = 0; i < 14; i++) {
    ctx.beginPath()
    ctx.arc((i * 263) % 1200, (i * 401) % 900, 60 + ((i * 37) % 90), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = '#fff'
  ctx.font = '600 64px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(label, 600, 470)
  ctx.font = '32px system-ui, sans-serif'
  ctx.fillText('(demo photo)', 600, 530)
  return new Promise((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.8))
}

function wait() {
  return new Promise((r) => setTimeout(r, 350 + Math.random() * 450))
}

function requireOnline() {
  if (!navigator.onLine) throw new OfflineError()
}

export const demoApi: Api = {
  demo: true,

  async joinEvent(input: JoinInput) {
    if (!navigator.onLine) return { ok: false, reason: 'offline' }
    await wait()
    const d = await db()
    const event = await d.get('events', input.eventCode.trim().toUpperCase())
    if (!event) return { ok: false, reason: 'bad_event' }

    const key = `${event.id}:${input.studentId}`
    const now = Date.now()
    const attempt = (await d.get('attempts', key)) ?? { failCount: 0, lockedUntil: 0 }
    if (attempt.lockedUntil > now) {
      return { ok: false, reason: 'locked', retryAfterSeconds: Math.ceil((attempt.lockedUntil - now) / 1000) }
    }

    const existing = await d.get('students', key)
    if (existing) {
      if (existing.nameKey !== nameKey(input.firstName)) {
        const failCount = attempt.failCount + 1
        if (failCount >= MAX_ATTEMPTS) {
          await d.put('attempts', { failCount: 0, lockedUntil: now + LOCK_MS }, key)
          return { ok: false, reason: 'locked', retryAfterSeconds: LOCK_MS / 1000 }
        }
        await d.put('attempts', { failCount, lockedUntil: 0 }, key)
        return { ok: false, reason: 'name_mismatch', attemptsLeft: MAX_ATTEMPTS - failCount }
      }
      await d.delete('attempts', key)
      const { nameKey: _k, ...student } = existing
      const submissions = await d.getAllFromIndex('submissions', 'byStudent', existing.id)
      return { ok: true, event, student, submissions, rejoined: true }
    }

    const row: StudentRow = {
      id: crypto.randomUUID(),
      eventId: event.id,
      studentId: input.studentId,
      firstName: input.firstName,
      country: input.country,
      nameKey: nameKey(input.firstName),
    }
    await d.put('students', row, key)
    await d.delete('attempts', key)
    const { nameKey: _k, ...student } = row
    return { ok: true, event, student, submissions: [], rejoined: false }
  },

  async fetchEvent(eventId: string) {
    if (!navigator.onLine) return null
    const d = await db()
    return (await d.getAll('events')).find((e) => e.id === eventId) ?? null
  },

  async pushSubmission(sub: Submission) {
    requireOnline()
    await wait()
    requireOnline()
    const d = await db()
    // One submission per stamp per student: a redo replaces the earlier one.
    const existing = await d.getAllFromIndex('submissions', 'byStudent', sub.studentId)
    const tx = d.transaction('submissions', 'readwrite')
    for (const e of existing) if (e.stampKey === sub.stampKey && e.id !== sub.id) await tx.store.delete(e.id)
    await tx.store.put({ ...sub, sync: 'synced' })
    await tx.done
  },
}
