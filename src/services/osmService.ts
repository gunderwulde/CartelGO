import { gridDisk, latLngToCell } from 'h3-js'
import { get, set } from 'idb-keyval'
import type { LatLng } from '../types'
import type { CachedCell, Poi } from '../types/poi'
import { fillSharedCell, readSharedCell, sharedCacheEnabled, type SharedCell } from './poiCache'
import { fetchCellPoisFromTiles } from './tilePois'

/** Resolución H3: ~0.7 km² por celda (la misma que el territorio de la Fase 2). */
export const H3_RES = 8
/** Celdas del anillo que se piden a la vez */
const RING_CONCURRENCY = 3
/** AGENTS.md: cachear al menos 24 h. */
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000
/** Una celda de la caché compartida se considera fresca este tiempo (la función usa el mismo) */
const SHARED_FRESH_MS = 14 * 24 * 60 * 60 * 1000

// v2: los POIs vienen de teselas vectoriales (ids "vt/…"), no de Overpass
const cacheKey = (cell: string): string => `cartelgo:cell2:${H3_RES}:${cell}`

async function readCache(cell: string): Promise<CachedCell | undefined> {
  try {
    return await get<CachedCell>(cacheKey(cell))
  } catch {
    return undefined
  }
}

async function writeCache(cell: string, value: CachedCell): Promise<void> {
  try {
    await set(cacheKey(cell), value)
  } catch {
    /* IndexedDB no disponible (modo privado): el juego sigue sin caché */
  }
}

/** Celdas que rodean al jugador: la suya primero y luego el anillo de 1. */
export function cellsAround(pos: LatLng): string[] {
  const center = latLngToCell(pos.lat, pos.lng, H3_RES)
  return [center, ...gridDisk(center, 1).filter((c) => c !== center)]
}

/**
 * Orden de fuentes: caché compartida (Supabase, lectura directa) → función de borde que la rellena
 * → teselas vectoriales leídas desde el propio móvil como último recurso.
 */
async function fetchFromNetwork(cell: string): Promise<Poi[]> {
  if (sharedCacheEnabled) {
    try {
      let shared: SharedCell | null = await readSharedCell(cell)
      if (shared && Date.now() - shared.fetchedAt < SHARED_FRESH_MS) return shared.pois
      shared = (await fillSharedCell(cell).catch(() => null)) ?? shared
      if (shared) return shared.pois // si la función falló, queda lo caducado
    } catch {
      /* Supabase caído: seguimos con las teselas */
    }
  }
  return fetchCellPoisFromTiles(cell)
}

export interface LoadResult {
  /** Celdas que no se pudieron refrescar (se reintentarán más tarde) */
  failedCells: string[]
  /** Se usaron datos caducados de la caché porque la red falló */
  stale: boolean
}

/**
 * Carga los POIs de las celdas cercanas de forma progresiva: lo cacheado sale al instante, la celda
 * del jugador se pide primero y el anillo después. Cada celda se entrega con `onPois` en cuanto está.
 * Solo lanza error si la celda del jugador no tiene ningún dato (ni fresco ni caducado).
 */
export async function loadPoisAround(
  pos: LatLng,
  onPois: (pois: Poi[]) => void,
  now = Date.now(),
): Promise<LoadResult> {
  const cells = cellsAround(pos)
  const [center] = cells
  const toFetch: string[] = []
  const failed = new Set<string>()
  const haveData = new Set<string>()
  let stale = false

  // 1) Caché primero: fresca o caducada, lo que haya, para pintar ya
  for (const c of cells) {
    const cached = await readCache(c)
    if (cached) {
      onPois(cached.pois)
      haveData.add(c)
    }
    if (!cached || now - cached.fetchedAt >= CACHE_TTL_MS) toFetch.push(c)
  }

  // 2) Red: solo lo que falta o caducó (AGENTS §3: nunca en cada lectura de GPS)
  const fetchCell = async (c: string): Promise<void> => {
    try {
      const pois = await fetchFromNetwork(c)
      await writeCache(c, { fetchedAt: Date.now(), pois })
      onPois(pois)
      haveData.add(c)
      failed.delete(c)
    } catch {
      failed.add(c)
      if (haveData.has(c)) stale = true
    }
  }

  if (toFetch.includes(center)) await fetchCell(center)
  const queue = toFetch.filter((c) => c !== center)
  const worker = async (): Promise<void> => {
    for (let c = queue.shift(); c !== undefined; c = queue.shift()) await fetchCell(c)
  }
  await Promise.all(Array.from({ length: RING_CONCURRENCY }, worker))

  if (!haveData.has(center)) throw new Error('Sin datos del barrio')
  return { failedCells: [...failed], stale }
}
