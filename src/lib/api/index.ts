import { supabaseApi } from './supabase'
import type { Api } from './types'

export const api: Api = supabaseApi
export type { Api, JoinInput, PlantInput, SaveInput } from './types'
