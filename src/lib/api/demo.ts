// Demo mode: runs entirely in this browser with sample data, used when no Supabase keys are set.
// Mirrors the rules in supabase/setup.sql so every screen behaves the same as the real thing.
import { drawDemoFlower, drawDemoPhoto } from '../demoArt'
import { DEFAULT_SEASONAL, STAMP_KEYS } from '../stamps'
import type { AdminRow, EventInfo, GardenFlower, StampKey, Student, Submission } from '../types'
import { nameKey } from '../validation'
import type { Api, JoinInput, PlantInput, SaveInput } from './types'

export const DEMO_EVENT_CODE = 'GBTB26'
export const DEMO_ADMIN_PASSCODE = 'demo'
export const DEMO_STUDENT = { studentId: '2500002', firstName: 'Lucas' }

const EVENT: EventInfo = {
  id: 'demo-event',
  code: DEMO_EVENT_CODE,
  name: 'Postcards from Singapore',
  eventDate: '2026-11-28',
  seasonalTitle: DEFAULT_SEASONAL.title,
  seasonalStampText: DEFAULT_SEASONAL.stampText,
  seasonalPrompt: DEFAULT_SEASONAL.prompt,
}

interface StudentRow extends Student {
  nameKey: string
}
interface SubmissionRow {
  id: string
  studentRowId: string
  stampKey: StampKey
  /** A data: URL, or "seed:<stampKey>" for generated sample photos. */
  photo: string
  reflection: string
  createdAt: string
  updatedAt: string
}
interface FlowerRow {
  id: string
  studentRowId: string
  /** A data: URL, or "seed:<n>" for generated sample drawings. */
  image: string
  flowerName: string
  meaning: string
  firstName: string
  country: string
  hidden: boolean
  createdAt: string
}
interface State {
  students: StudentRow[]
  submissions: SubmissionRow[]
  flowers: FlowerRow[]
  postcards: string[]
  admins: string[]
}

const STORE_KEY = 'postcards:demo:v1'

const LUCAS_REFLECTIONS: Record<StampKey, string> = {
  flower_home: 'Hibiscus! My grandmother grows them by the front door in São Paulo, so seeing them here made me smile.',
  this_is_sg: 'The skyline at sunset with the Supertrees lighting up. Old and new, nature and city, all side by side.',
  swap_story: 'Wei Ming taught me "shiok" (so good!) and I taught him "saudade". He says I must try chilli crab; I told him about pão de queijo.',
  bridge: 'Fairy lights and lanterns: Singapore mixes Christmas with lanterns, and back home we light up the streets for Natal too.',
  seasonal: 'The model station looks just like Bayfront! I ride the Downtown Line every morning to class.',
}

const SEED_PEOPLE: { first: string; country: string; stamps: number; postcard: boolean; flower: string; meaning: string }[] = [
  { first: 'Lucas', country: 'Brazil', stamps: 5, postcard: true, flower: 'Saudade bloom', meaning: 'Missing home, but finding new friends here.' },
  { first: 'Aisha', country: 'Malaysia', stamps: 4, postcard: false, flower: 'Sunny Aisha', meaning: 'The warmth of family dinners back in Penang.' },
  { first: 'Kenji', country: 'Japan', stamps: 5, postcard: true, flower: 'Night violet', meaning: 'Quiet evenings studying by the river.' },
  { first: 'Wei Ming', country: 'Singapore', stamps: 5, postcard: true, flower: 'Red packet tulip', meaning: 'Chinese New Year with my whole family.' },
  { first: 'Sofia', country: 'Italy', stamps: 3, postcard: false, flower: 'Daisy di Roma', meaning: 'Simple things: coffee, sunshine, friends.' },
  { first: 'Priya', country: 'India', stamps: 5, postcard: false, flower: 'Diwali rose', meaning: 'Lights, sweets and my mum\'s rangoli.' },
  { first: 'Omar', country: 'Egypt', stamps: 2, postcard: false, flower: 'Nile lily', meaning: 'Where I come from, and how far I\'ve travelled.' },
  { first: 'Linh', country: 'Vietnam', stamps: 5, postcard: true, flower: 'Blue lantern', meaning: 'Hoi An lanterns and my first month in Singapore.' },
  { first: 'Hana', country: 'South Korea', stamps: 4, postcard: false, flower: 'Cherry glow', meaning: 'Spring at home, all year round here.' },
  { first: 'Nurul', country: 'Singapore', stamps: 5, postcard: true, flower: 'Kampung star', meaning: 'Growing up with neighbours who felt like family.' },
  { first: 'Emma', country: 'Germany', stamps: 3, postcard: false, flower: 'Winter lily', meaning: 'A Christmas market feeling in the tropics.' },
  { first: 'Rizal', country: 'Indonesia', stamps: 5, postcard: false, flower: 'Sunset sunflower', meaning: 'Courage to try new things this semester.' },
]

function seed(): State {
  const state: State = { students: [], submissions: [], flowers: [], postcards: [], admins: [] }
  const start = Date.now() - 1000 * 60 * 90
  SEED_PEOPLE.forEach((p, i) => {
    const id = `demo-student-${i}`
    const at = new Date(start + i * 60_000 * 6).toISOString()
    state.students.push({
      id,
      eventId: EVENT.id,
      studentId: i === 0 ? DEMO_STUDENT.studentId : String(2500100 + i),
      firstName: p.first,
      country: p.country,
      nameKey: nameKey(p.first),
    })
    STAMP_KEYS.slice(0, p.stamps).forEach((key) =>
      state.submissions.push({
        id: `${id}-${key}`,
        studentRowId: id,
        stampKey: key,
        photo: `seed:${key}`,
        reflection: i === 0 ? LUCAS_REFLECTIONS[key] : `A moment from the Flower Dome, shared by ${p.first}.`,
        createdAt: at,
        updatedAt: at,
      }),
    )
    if (p.postcard) state.postcards.push(id)
    state.flowers.push({
      id: `demo-flower-${i}`,
      studentRowId: id,
      image: `seed:${i}`,
      flowerName: p.flower,
      meaning: p.meaning,
      firstName: p.first,
      country: p.country,
      hidden: false,
      createdAt: at,
    })
  })
  return state
}

let state: State = load()

function load(): State {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) return JSON.parse(raw) as State
  } catch {
    // Fall through to fresh sample data.
  }
  const fresh = seed()
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(fresh))
  } catch {
    // Storage unavailable: the demo still works for this page view.
  }
  return fresh
}

let saveFailed = false

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state))
    saveFailed = false
  } catch {
    // Storage full (large photos): changes still work until the page is reloaded.
    saveFailed = true
  }
}

/** Pick up changes made in other tabs (e.g. admin hiding a flower), like the real 15-second refresh. */
function refresh() {
  if (!saveFailed) state = load()
}

/** Start the demo again from the sample data. */
export function resetDemo() {
  state = seed()
  save()
}

const artCache = new Map<string, string>()
function resolveArt(token: string): string {
  if (!token.startsWith('seed:')) return token
  let url = artCache.get(token)
  if (!url) {
    const v = token.slice(5)
    url = /^\d+$/.test(v) ? drawDemoFlower(Number(v)) : drawDemoPhoto(v as StampKey)
    artCache.set(token, url)
  }
  return url
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

function wait(ms = 250 + Math.random() * 300) {
  return new Promise((r) => setTimeout(r, ms))
}

function toSubmission(r: SubmissionRow): Submission {
  return {
    id: r.id,
    stampKey: r.stampKey,
    photoUrl: resolveArt(r.photo),
    reflection: r.reflection,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

function toFlower(f: FlowerRow): GardenFlower {
  return {
    id: f.id,
    imageUrl: resolveArt(f.image),
    flowerName: f.flowerName,
    meaning: f.meaning,
    firstName: f.firstName,
    country: f.country,
    createdAt: f.createdAt,
  }
}

function strip(row: StudentRow): Student {
  const { nameKey: _k, ...student } = row
  return student
}

export const demoApi: Api = {
  demo: true,

  async joinEvent(input: JoinInput) {
    await wait()
    if (input.eventCode.trim().toUpperCase() !== EVENT.code) return { ok: false, reason: 'bad_event' }
    const existing = state.students.find((s) => s.studentId === input.studentId)
    if (existing) {
      if (existing.nameKey !== nameKey(input.firstName)) return { ok: false, reason: 'name_mismatch' }
      return { ok: true, event: EVENT, student: strip(existing), rejoined: true }
    }
    const row: StudentRow = {
      id: crypto.randomUUID(),
      eventId: EVENT.id,
      studentId: input.studentId,
      firstName: input.firstName,
      country: input.country,
      nameKey: nameKey(input.firstName),
    }
    state.students.push(row)
    save()
    return { ok: true, event: EVENT, student: strip(row), rejoined: false }
  },

  async fetchEvent() {
    return EVENT
  },

  async isLinked(student: Student) {
    return state.students.some((s) => s.id === student.id)
  },

  async fetchSubmissions(student: Student) {
    await wait(150)
    return state.submissions.filter((s) => s.studentRowId === student.id).map(toSubmission)
  },

  async saveSubmission(student: Student, input: SaveInput) {
    await wait(600)
    const existing = state.submissions.find((s) => s.studentRowId === student.id && s.stampKey === input.stampKey)
    const photo = input.photo ? await blobToDataUrl(input.photo) : existing?.photo
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
    state.submissions = [...state.submissions.filter((s) => s !== existing), row]
    save()
    return toSubmission(row)
  },

  async logout() {},

  async recordPostcard(student: Student) {
    if (!state.postcards.includes(student.id)) state.postcards.push(student.id)
    save()
  },

  async fetchMyFlower(student: Student) {
    const f = state.flowers.find((x) => x.studentRowId === student.id)
    return f ? toFlower(f) : null
  },

  async plantFlower(student: Student, input: PlantInput) {
    await wait(600)
    const image = await blobToDataUrl(input.image)
    const existing = state.flowers.find((f) => f.studentRowId === student.id)
    const row: FlowerRow = existing
      ? { ...existing, image, flowerName: input.flowerName, meaning: input.meaning }
      : {
          id: crypto.randomUUID(),
          studentRowId: student.id,
          image,
          flowerName: input.flowerName,
          meaning: input.meaning,
          firstName: student.firstName,
          country: student.country,
          hidden: false,
          createdAt: new Date().toISOString(),
        }
    state.flowers = [...state.flowers.filter((f) => f !== existing), row]
    save()
    return toFlower(row)
  },

  async fetchGarden(eventCode: string) {
    if (eventCode.trim().toUpperCase() !== EVENT.code) return null
    refresh()
    return state.flowers
      .filter((f) => !f.hidden)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(toFlower)
  },

  async adminLogin(eventCode: string, passcode: string) {
    await wait()
    if (eventCode.trim().toUpperCase() !== EVENT.code || passcode !== DEMO_ADMIN_PASSCODE) return null
    if (!state.admins.includes(EVENT.id)) state.admins.push(EVENT.id)
    save()
    return EVENT.id
  },

  async adminIsLoggedIn(eventId: string) {
    return state.admins.includes(eventId)
  },

  async adminProgress() {
    refresh()
    return state.students.map((s): AdminRow => {
      const f = state.flowers.find((x) => x.studentRowId === s.id)
      return {
        studentRowId: s.id,
        studentId: s.studentId,
        firstName: s.firstName,
        country: s.country,
        stamps: state.submissions.filter((x) => x.studentRowId === s.id).length,
        postcardMade: state.postcards.includes(s.id),
        flowerId: f?.id ?? null,
        flowerName: f?.flowerName ?? null,
        flowerHidden: f?.hidden ?? null,
        flowerImageUrl: f ? resolveArt(f.image) : null,
      }
    })
  },

  async adminSetFlowerHidden(flowerId: string, hidden: boolean) {
    await wait(200)
    state.flowers = state.flowers.map((f) => (f.id === flowerId ? { ...f, hidden } : f))
    save()
  },

  async adminDeleteAll() {
    await wait(800)
    state = { students: [], submissions: [], flowers: [], postcards: [], admins: state.admins }
    save()
  },
}
