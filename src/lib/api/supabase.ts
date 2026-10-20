import { ensureSignedIn, hasSession, supabase } from '../supabase'
import type { AdminRow, EventInfo, GardenFlower, JoinResult, StampKey, Student, Submission } from '../types'
import type { Api, JoinInput, PlantInput, SaveInput } from './types'

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

interface FlowerRow {
  id: string
  image_path: string
  flower_name: string
  meaning: string
  first_name: string
  country: string
  created_at: string
}

const SUBMISSION_COLS = 'id, stamp_key, photo_path, reflection, created_at, updated_at'
const FLOWER_COLS = 'id, image_path, flower_name, meaning, first_name, country, created_at'

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

function flowerUrl(path: string) {
  return supabase.storage.from('flowers').getPublicUrl(path).data.publicUrl
}

function toFlower(r: FlowerRow): GardenFlower {
  return {
    id: r.id,
    imageUrl: flowerUrl(r.image_path),
    flowerName: r.flower_name,
    meaning: r.meaning,
    firstName: r.first_name,
    country: r.country,
    createdAt: r.created_at,
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

/** Every file under <eventId>/<student>/ in a bucket. */
async function listEventFiles(bucket: string, eventId: string): Promise<string[]> {
  const { data: folders, error } = await supabase.storage.from(bucket).list(eventId, { limit: 1000 })
  if (error) throw error
  const paths: string[] = []
  for (const folder of folders) {
    const { data: files, error: e2 } = await supabase.storage.from(bucket).list(`${eventId}/${folder.name}`, { limit: 1000 })
    if (e2) throw e2
    for (const f of files) paths.push(`${eventId}/${folder.name}/${f.name}`)
  }
  return paths
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

  async recordPostcard(student: Student, submissionId: string) {
    const { error } = await supabase.from('postcards').insert({ student_id: student.id, submission_id: submissionId })
    if (error) console.error('Could not record postcard', error)
  },

  async fetchMyFlower(student: Student) {
    const { data, error } = await supabase
      .from('flowers')
      .select(FLOWER_COLS)
      .eq('student_id', student.id)
      .maybeSingle<FlowerRow>()
    if (error) throw error
    return data ? toFlower(data) : null
  },

  async plantFlower(student: Student, input: PlantInput) {
    const imagePath = `${student.eventId}/${student.id}/flower-${crypto.randomUUID()}.png`
    const { error: upErr } = await supabase.storage
      .from('flowers')
      .upload(imagePath, input.image, { contentType: 'image/png', upsert: false })
    if (upErr) throw upErr

    const { data: previous } = await supabase
      .from('flowers')
      .select('id, image_path')
      .eq('student_id', student.id)
      .maybeSingle<{ id: string; image_path: string }>()

    const fields = { image_path: imagePath, flower_name: input.flowerName, meaning: input.meaning }
    // Insert and update are separate because students may only update these three columns.
    const query = previous
      ? supabase.from('flowers').update(fields).eq('id', previous.id)
      : supabase.from('flowers').insert({ ...fields, student_id: student.id })
    const { data, error } = await query.select(FLOWER_COLS).single<FlowerRow>()
    if (error) throw error

    if (previous) void supabase.storage.from('flowers').remove([previous.image_path])
    return toFlower(data)
  },

  async fetchGarden(eventCode: string) {
    const { data: event, error: evErr } = await supabase
      .from('events')
      .select('id')
      .eq('code', eventCode.trim().toUpperCase())
      .maybeSingle<{ id: string }>()
    if (evErr) throw evErr
    if (!event) return null
    const { data, error } = await supabase
      .from('flowers')
      .select(FLOWER_COLS)
      .eq('event_id', event.id)
      .eq('hidden', false)
      .order('created_at')
      .returns<FlowerRow[]>()
    if (error) throw error
    return data.map(toFlower)
  },

  async adminLogin(eventCode: string, passcode: string) {
    await ensureSignedIn()
    const { data, error } = await supabase.rpc('admin_login', { p_event_code: eventCode, p_passcode: passcode })
    if (error) throw error
    return (data as string | null) ?? null
  },

  async adminIsLoggedIn(eventId: string) {
    if (!(await hasSession())) return false
    const { data, error } = await supabase.rpc('is_admin', { p_event_id: eventId })
    if (error) throw error
    return !!data
  },

  async adminProgress(eventId: string) {
    const { data, error } = await supabase.rpc('admin_progress', { p_event_id: eventId })
    if (error) throw error
    return (data as Record<string, unknown>[]).map(
      (r): AdminRow => ({
        studentRowId: r.student_row_id as string,
        studentId: r.student_id as string,
        firstName: r.first_name as string,
        country: r.country as string,
        stamps: r.stamps as number,
        postcardMade: r.postcard_made as boolean,
        flowerId: (r.flower_id as string) ?? null,
        flowerName: (r.flower_name as string) ?? null,
        flowerHidden: (r.flower_hidden as boolean) ?? null,
        flowerImageUrl: r.flower_image_path ? flowerUrl(r.flower_image_path as string) : null,
      }),
    )
  },

  async adminSetFlowerHidden(flowerId: string, hidden: boolean) {
    const { error } = await supabase.rpc('admin_set_flower_hidden', { p_flower_id: flowerId, p_hidden: hidden })
    if (error) throw error
  },

  async adminDeleteAll(eventId: string) {
    // Files first (the database can't delete Storage files itself), then all rows.
    for (const bucket of ['photos', 'flowers']) {
      const paths = await listEventFiles(bucket, eventId)
      for (let i = 0; i < paths.length; i += 100) {
        const { error } = await supabase.storage.from(bucket).remove(paths.slice(i, i + 100))
        if (error) throw error
      }
    }
    const { error } = await supabase.rpc('admin_delete_event_data', { p_event_id: eventId })
    if (error) throw error
  },
}
