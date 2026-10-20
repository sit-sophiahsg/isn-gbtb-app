import type { AdminRow, EventInfo, GardenFlower, JoinResult, StampKey, Student, Submission } from '../types'

export interface JoinInput {
  eventCode: string
  studentId: string
  firstName: string
  country: string
}

export interface SaveInput {
  stampKey: StampKey
  /** A new photo, or null to keep the photo already saved for this stamp. */
  photo: Blob | null
  reflection: string
}

export interface PlantInput {
  /** Transparent PNG of the bloom. */
  image: Blob
  flowerName: string
  meaning: string
}

/** Everything the app needs from the backend (Supabase). */
export interface Api {
  joinEvent(input: JoinInput): Promise<JoinResult>
  /** Latest event details (organisers can edit the seasonal stamp in Supabase). */
  fetchEvent(eventId: string): Promise<EventInfo | null>
  /** False if this browser is no longer logged in as the student (e.g. site data was cleared). */
  isLinked(student: Student): Promise<boolean>
  fetchSubmissions(student: Student): Promise<Submission[]>
  /** Save one stamp. Throws if the upload fails, so the screen can offer "Try again". */
  saveSubmission(student: Student, input: SaveInput): Promise<Submission>
  logout(): Promise<void>

  recordPostcard(student: Student, submissionId: string): Promise<void>
  fetchMyFlower(student: Student): Promise<GardenFlower | null>
  /** Plant (or replant) this student's one flower. Throws on failure. */
  plantFlower(student: Student, input: PlantInput): Promise<GardenFlower>
  /** Visible flowers for the garden; null if the event code doesn't exist. */
  fetchGarden(eventCode: string): Promise<GardenFlower[] | null>

  /** Returns the event id if the passcode is right, otherwise null. */
  adminLogin(eventCode: string, passcode: string): Promise<string | null>
  adminIsLoggedIn(eventId: string): Promise<boolean>
  adminProgress(eventId: string): Promise<AdminRow[]>
  adminSetFlowerHidden(flowerId: string, hidden: boolean): Promise<void>
  /** Deletes every student, stamp, photo, postcard record and flower for the event. */
  adminDeleteAll(eventId: string): Promise<void>
}
