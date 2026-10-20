export type Phase =
  | 'welcome' | 'walk' | 'grouping' | 'briefing' | 'rally' | 'return' | 'gallery' | 'closing'

export const PHASES: Phase[] = [
  'welcome', 'walk', 'grouping', 'briefing', 'rally', 'return', 'gallery', 'closing',
]

export interface EventRow {
  id: number
  name: string
  club_name: string
  phase: Phase
  welcome_md: string
  programme_md: string
  walk_md: string
  briefing_md: string
  return_md: string
  closing_message_md: string
  meeting_point: string
  feedback_url: string
  rally_started_at: string | null
  rally_ends_at: string | null
}

export interface Group {
  id: string
  name: string
  emoji: string
  leader_name: string
  sort_order: number
  finished_at: string | null
}

export interface Checkpoint {
  id: string
  sort_order: number
  name: string
  location_hint: string
  method: 'photo' | 'qr'
  task_prompt: string
  question: string | null
  points: number
  active: boolean
}

export interface Stamp {
  id: string
  group_id: string
  checkpoint_id: string
  method: 'photo' | 'qr' | 'manual'
  status: 'ok' | 'rejected'
  photo_id: string | null
  stamped_at: string
  question_attempts: number
  question_correct: boolean | null
  points: number | null
  rejected_reason: string | null
}

export interface Photo {
  id: string
  group_id: string
  checkpoint_id: string | null
  storage_path: string
  caption: string
  hidden: boolean
  created_at: string
}

export interface Person {
  id: string
  kind: 'exco' | 'new_committee'
  name: string
  role: string
  photo_path: string | null
  sort_order: number
}
