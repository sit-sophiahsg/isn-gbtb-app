export type StampKey = 'flower_home' | 'this_is_sg' | 'swap_story' | 'bridge' | 'seasonal'

export interface EventInfo {
  id: string
  code: string
  name: string
  /** ISO date (YYYY-MM-DD); used on the postcard postmark. */
  eventDate: string
  seasonalTitle: string
  /** Stamp centre text, one line per row (1–3 lines). */
  seasonalStampText: string
  seasonalPrompt: string
}

export interface Student {
  id: string
  eventId: string
  studentId: string
  firstName: string
  country: string
}

export type SyncState = 'pending' | 'synced'

export interface Submission {
  /** Generated on the phone so retries never create duplicates. */
  id: string
  studentId: string
  stampKey: StampKey
  photo: Blob
  reflection: string
  createdAt: string
  updatedAt: string
  sync: SyncState
}

export type JoinResult =
  | { ok: true; event: EventInfo; student: Student; submissions: Submission[]; rejoined: boolean }
  | { ok: false; reason: 'bad_event' | 'name_mismatch' | 'locked' | 'offline'; retryAfterSeconds?: number; attemptsLeft?: number }
