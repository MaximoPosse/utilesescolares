import { createClient } from '@supabase/supabase-js'

const url = String(import.meta.env.VITE_SUPABASE_URL || '').trim()
const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

/**
 * Solo se usa la clave pública (anon). La clave service_role nunca debe
 * incluirse en el cliente. Si no hay configuración, la app usa el modo demo.
 */
export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
