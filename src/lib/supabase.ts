import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

let cachedClient: SupabaseClient | null = null

export const hasSupabaseEnv = Boolean(supabaseUrl && supabaseAnonKey)

export function getSupabaseClient() {
  if (!hasSupabaseEnv) {
    return null
  }

  if (!cachedClient) {
    cachedClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  }

  return cachedClient
}
