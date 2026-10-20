import { supabaseConfigured } from '../supabase'
import { demoApi } from './demo'
import { supabaseApi } from './supabase'
import type { Api } from './types'

/** Supabase when its keys are set; otherwise demo mode with sample data in this browser. */
export const api: Api = supabaseConfigured ? supabaseApi : demoApi
export type { Api, JoinInput, PlantInput, SaveInput } from './types'
