import type { SupabaseClient } from '@supabase/supabase-js'

const URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '')
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Sin variables de entorno el juego funciona igual, solo en local (sin cuenta ni nube). */
export const backendEnabled = Boolean(URL && KEY)

let client: Promise<SupabaseClient> | null = null

/** Cliente de Supabase con carga diferida: la librería no pesa hasta que hace falta. */
export function getSupabase(): Promise<SupabaseClient> {
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(URL ?? '', KEY ?? '', {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false, // el inicio de sesión es con código, no con enlace
        storageKey: 'cartelgo:auth',
      },
    }),
  )
  return client
}
