import { isSupabaseConfigured, supabase } from '../lib/supabase.js'
import { fullName } from '../data/utils.js'
import { demoApi } from './demoApi.js'
import { supabaseApi } from './supabaseApi.js'

export const APP_MODE = isSupabaseConfigured ? 'supabase' : 'demo'
export const IS_DEMO = !isSupabaseConfigured

export const api = isSupabaseConfigured ? supabaseApi : demoApi

export { supabase, isSupabaseConfigured, fullName }
