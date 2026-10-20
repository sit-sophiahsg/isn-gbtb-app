import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const configured = Boolean(url && key)

export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing', {
  realtime: { params: { eventsPerSecond: 5 } },
})

export function photoUrl(path: string) {
  return supabase.storage.from('photos').getPublicUrl(path).data.publicUrl
}
