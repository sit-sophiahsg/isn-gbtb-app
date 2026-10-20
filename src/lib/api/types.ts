import type { EventInfo, JoinResult, Submission } from '../types'

export interface JoinInput {
  eventCode: string
  studentId: string
  firstName: string
  country: string
}

/** Everything the app needs from the backend. M1 uses an in-browser demo server; M2 swaps in Supabase. */
export interface Api {
  /** True for the in-browser demo server (data never leaves this phone). */
  readonly demo: boolean
  joinEvent(input: JoinInput): Promise<JoinResult>
  /** Latest event details (organisers can edit the seasonal stamp). Null when unreachable. */
  fetchEvent(eventId: string): Promise<EventInfo | null>
  /** Upload one submission. Idempotent: retries with the same id never duplicate. Throws when offline. */
  pushSubmission(sub: Submission): Promise<void>
}

export class OfflineError extends Error {
  constructor() {
    super('No connection')
  }
}
