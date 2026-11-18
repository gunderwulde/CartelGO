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
// Las celdas no caducan: una vez creadas se quedan para siempre (AGENTS §3 pide como mínimo 24 h).
// Si algún día cambian las reglas de clasificación, se sube la versión de cacheKey para invalidarlas.

// v3: POIs de teselas vectoriales (ids "vt/…") con límite por tipo y celda
const cacheKey = (cell: string): string => `cartelgo:cell3:${H3_RES}:${cell}`

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
      const shared: SharedCell | null = (await readSharedCell(cell)) ?? (await fillSharedCell(cell).catch(() => null))
      if (shared) return shared.pois
    } catch {
      /* Supabase caído: seguimos con las teselas */
    }
  }
  return fetchCellPoisFromTiles(cell)
}

export interface LoadResult {
  /** Celdas que no se pudieron refrescar (se reintentarán más tarde) */
  failedCells: string[]
}

/**
 * Carga los POIs de las celdas cercanas de forma progresiva: lo cacheado sale al instante y no se vuelve a pedir, la celda
 * del jugador se pide primero y el anillo después. Cada celda se entrega con `onPois` en cuanto está.
 * Solo lanza error si la celda del jugador no tiene ningún dato (ni en caché ni en la red).
 */
export async function loadPoisAround(
  pos: LatLng,
  onPois: (pois: Poi[]) => void,
): Promise<LoadResult> {
  const cells = cellsAround(pos)
  const [center] = cells
  const toFetch: string[] = []
  const failed = new Set<string>()
  const haveData = new Set<string>()

  // 1) Caché primero: fresca o caducada, lo que haya, para pintar ya
  for (const c of cells) {
    const cached = await readCache(c)
    if (cached) {
      onPois(cached.pois)
      haveData.add(c)
    }
    if (!cached) toFetch.push(c)
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
    }
  }

  if (toFetch.includes(center)) await fetchCell(center)
  const queue = toFetch.filter((c) => c !== center)
  const worker = async (): Promise<void> => {
    for (let c = queue.shift(); c !== undefined; c = queue.shift()) await fetchCell(c)
  }
  await Promise.all(Array.from({ length: RING_CONCURRENCY }, worker))

  if (!haveData.has(center)) throw new Error('Sin datos del barrio')
  return { failedCells: [...failed] }
}
