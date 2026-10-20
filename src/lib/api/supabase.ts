import { ensureSignedIn, hasSession, supabase } from '../supabase'
import type { EventInfo, JoinResult, StampKey, Student, Submission } from '../types'
import type { Api, JoinInput, SaveInput } from './types'

const PHOTO_URL_SECONDS = 60 * 60 * 6

interface EventRow {
  id: string
  code: string
  name: string
  event_date: string
  seasonal_title: string
  seasonal_stamp_text: string
  seasonal_prompt: string
}

interface SubmissionRow {
  id: string
  stamp_key: StampKey
  photo_path: string
  reflection: string
  created_at: string
  updated_at: string
}

const SUBMISSION_COLS = 'id, stamp_key, photo_path, reflection, created_at, updated_at'

function toEvent(r: EventRow): EventInfo {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    eventDate: r.event_date,
    seasonalTitle: r.seasonal_title,
    seasonalStampText: r.seasonal_stamp_text,
    seasonalPrompt: r.seasonal_prompt,
  }
}

async function withPhotoUrls(rows: SubmissionRow[]): Promise<Submission[]> {
  if (!rows.length) return []
  const { data, error } = await supabase.storage.from('photos').createSignedUrls(
    rows.map((r) => r.photo_path),
    PHOTO_URL_SECONDS,
  )
  if (error) throw error
  const urls = new Map(data.map((d) => [d.path, d.signedUrl]))
  return rows.map((r) => ({
    id: r.id,
    stampKey: r.stamp_key,
    photoUrl: urls.get(r.photo_path) ?? '',
    reflection: r.reflection,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))
}

export const supabaseApi: Api = {
  async joinEvent(input: JoinInput): Promise<JoinResult> {
    try {
      await ensureSignedIn()
      const { data, error } = await supabase.rpc('join_event', {
        p_event_code: input.eventCode,
        p_student_id: input.studentId,
        p_first_name: input.firstName,
        p_country: input.country,
      })
      if (error) throw error
      return data as JoinResult
    } catch (e) {
      console.error('join_event failed', e)
      return { ok: false, reason: 'network' }
    }
  },

  async fetchEvent(eventId: string) {
    const { data, error } = await supabase
      .from('events')
      .select('id, code, name, event_date, seasonal_title, seasonal_stamp_text, seasonal_prompt')
      .eq('id', eventId)
      .maybeSingle<EventRow>()
    if (error) throw error
    return data ? toEvent(data) : null
  },

  async isLinked(student: Student) {
    if (!(await hasSession())) return false
    const { data, error } = await supabase.from('students').select('id').eq('id', student.id).maybeSingle()
    if (error) throw error
    return !!data
  },

  async fetchSubmissions(student: Student) {
    const { data, error } = await supabase
      .from('submissions')
      .select(SUBMISSION_COLS)
      .eq('student_id', student.id)
      .returns<SubmissionRow[]>()
    if (error) throw error
    return withPhotoUrls(data)
  },

  async saveSubmission(student: Student, input: SaveInput) {
    const { data: previous } = await supabase
      .from('submissions')
      .select('photo_path')
      .eq('student_id', student.id)
      .eq('stamp_key', input.stampKey)
      .maybeSingle<{ photo_path: string }>()

    let photoPath = previous?.photo_path
    if (input.photo) {
      photoPath = `${student.eventId}/${student.id}/${input.stampKey}-${crypto.randomUUID()}.jpg`
      const { error } = await supabase.storage
        .from('photos')
        .upload(photoPath, input.photo, { contentType: 'image/jpeg', upsert: false })
      if (error) throw error
    }
    if (!photoPath) throw new Error('Photo required')

    const { data, error } = await supabase
      .from('submissions')
      .upsert(
        {
          student_id: student.id,
          stamp_key: input.stampKey,
          photo_path: photoPath,
          reflection: input.reflection,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'student_id,stamp_key' },
      )
      .select(SUBMISSION_COLS)
      .single<SubmissionRow>()
    if (error) throw error

    // Tidy up the replaced photo; not critical if it fails.
    if (previous && previous.photo_path !== photoPath) {
      void supabase.storage.from('photos').remove([previous.photo_path])
    }
    const [saved] = await withPhotoUrls([data])
    return saved
  },

  async logout() {
    await supabase.auth.signOut().catch(() => undefined)
  },
}
