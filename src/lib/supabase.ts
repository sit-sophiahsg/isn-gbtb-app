import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** False until the two Supabase environment variables are set (see README). */
export const supabaseConfigured = !!(url && key)

export const supabase: SupabaseClient = supabaseConfigured
  ? createClient(url!, key!)
  : (null as unknown as SupabaseClient)

/**
 * Students never see a login: each browser gets a Supabase anonymous login, which the
 * database links to a student when they enter their student ID and first name.
 */
export async function ensureSignedIn(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  if (data.session) return data.session.user.id
  const { data: signedIn, error } = await supabase.auth.signInAnonymously()
  if (error || !signedIn.user) throw error ?? new Error('Anonymous sign-in failed')
  return signedIn.user.id
}

export async function hasSession(): Promise<boolean> {
  const { data } = await supabase.auth.getSession()
  return !!data.session
}
