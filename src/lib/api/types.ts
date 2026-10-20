import type { EventInfo, JoinResult, StampKey, Student, Submission } from '../types'

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

/** Everything the app needs from the backend. */
export interface Api {
  joinEvent(input: JoinInput): Promise<JoinResult>
  /** Latest event details (organisers can edit the seasonal stamp in Supabase). */
  fetchEvent(eventId: string): Promise<EventInfo | null>
  fetchSubmissions(student: Student): Promise<Submission[]>
  /** Save one stamp. Throws if the upload fails, so the screen can offer "Try again". */
  saveSubmission(student: Student, input: SaveInput): Promise<Submission>
}
