import type { Poi } from '../types/poi'

/**
 * Caché compartida de POIs en Supabase (misma para todos los jugadores).
 * Se configura con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (la clave anónima es pública por diseño;
 * la seguridad la da RLS: solo lectura). Si no hay configuración, el juego usa Overpass directo.
 */
const URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '')
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const TIMEOUT_MS = 35_000

export const sharedCacheEnabled = Boolean(URL && KEY)

export interface SharedCell {
  fetchedAt: number
  pois: Poi[]
}

interface Row {
  fetched_at: string
  pois: Poi[]
}

const headers = (): Record<string, string> => ({ apikey: KEY ?? '', Authorization: `Bearer ${KEY ?? ''}` })

/** Lectura directa de la tabla: no gasta invocaciones de funciones. null si la celda no está. */
export async function readSharedCell(cell: string): Promise<SharedCell | null> {
  if (!sharedCacheEnabled) return null
  const res = await fetch(`${URL}/rest/v1/poi_cells?cell=eq.${encodeURIComponent(cell)}&select=fetched_at,pois`, {
    headers: headers(),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}`)
  const rows = (await res.json()) as Row[]
  const row = rows[0]
  return row ? { fetchedAt: new Date(row.fetched_at).getTime(), pois: row.pois } : null
}

/** Pide a la función de borde que rellene (o refresque) la celda. Ella habla con Overpass. */
export async function fillSharedCell(cell: string): Promise<SharedCell> {
  const res = await fetch(`${URL}/functions/v1/poi-cell`, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ cell }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`poi-cell ${res.status}`)
  const row = (await res.json()) as Row
  return { fetchedAt: new Date(row.fetched_at).getTime(), pois: row.pois }
}
