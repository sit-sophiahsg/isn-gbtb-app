// In-browser stand-in for the Supabase backend, until M2 replaces it.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { DEFAULT_SEASONAL } from '../stamps'
import type { EventInfo, StampKey, Student, Submission } from '../types'
import { nameKey } from '../validation'
import type { Api, JoinInput, SaveInput } from './types'

interface StudentRow extends Student {
  nameKey: string
}
interface SubmissionRow {
  id: string
  studentRowId: string
  stampKey: StampKey
  photo: Blob
  reflection: string
  createdAt: string
  updatedAt: string
}

interface ServerDB extends DBSchema {
  students: { key: string; value: StudentRow }
  submissions: { key: string; value: SubmissionRow; indexes: { byStudent: string } }
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

let dbPromise: Promise<IDBPDatabase<ServerDB>> | null = null

function db() {
  dbPromise ??= openDB<ServerDB>('postcards-demo-server-v2', 1, {
    upgrade(d) {
      d.createObjectStore('students')
      d.createObjectStore('submissions').createIndex('byStudent', 'studentRowId')
    },
  })
  return dbPromise
}

function wait() {
  return new Promise((r) => setTimeout(r, 300 + Math.random() * 400))
}

export const demoApi: Api = {
  async joinEvent(input: JoinInput) {
    if (!navigator.onLine) return { ok: false, reason: 'network' }
    await wait()
    if (input.eventCode.trim().toUpperCase() !== DEMO_EVENT.code) return { ok: false, reason: 'bad_event' }
    const d = await db()
    const key = input.studentId
    const existing = await d.get('students', key)
    if (existing) {
      if (existing.nameKey !== nameKey(input.firstName)) return { ok: false, reason: 'name_mismatch' }
      const { nameKey: _k, ...student } = existing
      return { ok: true, event: DEMO_EVENT, student, rejoined: true }
    }
    const row: StudentRow = {
      id: crypto.randomUUID(),
      eventId: DEMO_EVENT.id,
      studentId: input.studentId,
      firstName: input.firstName,
      country: input.country,
      nameKey: nameKey(input.firstName),
    }
    await d.put('students', row, key)
    const { nameKey: _k, ...student } = row
    return { ok: true, event: DEMO_EVENT, student, rejoined: false }
  },

  async fetchEvent() {
    return DEMO_EVENT
  },

  async fetchSubmissions(student: Student) {
    const rows = await (await db()).getAllFromIndex('submissions', 'byStudent', student.id)
    return rows.map(toSubmission)
  },

  async saveSubmission(student: Student, input: SaveInput) {
    await wait()
    if (!navigator.onLine) throw new Error('No connection')
    const d = await db()
    const key = `${student.id}:${input.stampKey}`
    const existing = await d.get('submissions', key)
    const photo = input.photo ?? existing?.photo
    if (!photo) throw new Error('Photo required')
    const now = new Date().toISOString()
    const row: SubmissionRow = {
      id: existing?.id ?? crypto.randomUUID(),
      studentRowId: student.id,
      stampKey: input.stampKey,
      photo,
      reflection: input.reflection,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    await d.put('submissions', row, key)
    return toSubmission(row)
  },
}

function toSubmission(r: SubmissionRow): Submission {
  return {
    id: r.id,
    stampKey: r.stampKey,
    photoUrl: URL.createObjectURL(r.photo),
    reflection: r.reflection,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}
