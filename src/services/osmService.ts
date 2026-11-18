import { cellToBoundary, gridDisk, latLngToCell } from 'h3-js'
import { get, set } from 'idb-keyval'
import type { LatLng } from '../types'
import type { CachedCell, Poi, PoiKind } from '../types/poi'
import { fillSharedCell, readSharedCell, sharedCacheEnabled, type SharedCell } from './poiCache'

/** Una celda de la caché compartida se considera fresca este tiempo (la función usa el mismo) */
const SHARED_FRESH_MS = 14 * 24 * 60 * 60 * 1000

/** Resolución H3: ~0.7 km² por celda (la misma que el territorio de la Fase 2). */
export const H3_RES = 8
/** Margen del bbox (grados) para no perder POIs que caen justo en el borde. */
const BBOX_MARGIN = 0.0005
/** Cada intento contra un servidor se corta a los 20 s */
const REQUEST_TIMEOUT_MS = 20_000
/** Si un servidor tarda más que esto, se lanza la misma petición contra el siguiente (sin cancelar el primero) */
const HEDGE_DELAY_MS = 3_500
/** Celdas del anillo que se piden a la vez */
const RING_CONCURRENCY = 2
/** AGENTS.md: cachear al menos 24 h. */
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]

const cacheKey = (cell: string): string => `cartelgo:cell:${H3_RES}:${cell}`

interface OverpassElement {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

/** Etiquetas OSM de cada rol del juego, agrupadas para que Overpass haga pocas pasadas. */
const SELECTORS = [
  '["amenity"~"^(pharmacy|bar|nightclub|police|car_wash)$"]',
  '["shop"~"^(laundry|car_wash)$"]',
  '["leisure"="park"]',
  '["landuse"="industrial"]',
]

/** Clasifica un elemento OSM; null si no encaja con ningún rol. */
export function classify(tags: Record<string, string>): PoiKind | null {
  if (tags.amenity === 'police') return 'police'
  if (tags.amenity === 'pharmacy') return 'pharmacy'
  if (tags.amenity === 'bar' || tags.amenity === 'nightclub') return 'nightlife'
  if (tags.shop === 'laundry' || tags.shop === 'car_wash' || tags.amenity === 'car_wash') return 'cover'
  if (tags.leisure === 'park') return 'park'
  if (tags.landuse === 'industrial') return 'warehouse'
  return null
}

/** Convierte la respuesta de Overpass en POIs del juego, asignados a su celda. */
export function parseElements(elements: OverpassElement[], allowedCells: Set<string>): Poi[] {
  const out = new Map<string, Poi>()
  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat
    const lng = el.lon ?? el.center?.lon
    if (lat === undefined || lng === undefined || !el.tags) continue
    const kind = classify(el.tags)
    if (!kind) continue
    const cell = latLngToCell(lat, lng, H3_RES)
    if (!allowedCells.has(cell)) continue
    const id = `${el.type}/${el.id}`
    out.set(id, { id, kind, name: el.tags.name ?? null, lat, lng, cell })
  }
  return [...out.values()]
}

/** Consulta de una sola celda: bbox pequeño, rápido para Overpass y cacheable por separado. */
export function buildCellQuery(cell: string): string {
  const pts = cellToBoundary(cell)
  const lats = pts.map((p) => p[0])
  const lngs = pts.map((p) => p[1])
  const bbox = [
    Math.min(...lats) - BBOX_MARGIN,
    Math.min(...lngs) - BBOX_MARGIN,
    Math.max(...lats) + BBOX_MARGIN,
    Math.max(...lngs) + BBOX_MARGIN,
  ]
    .map((n) => n.toFixed(5))
    .join(',')
  const parts = SELECTORS.map((sel) => `nwr${sel}(${bbox});`)
  return `[out:json][timeout:20];(${parts.join('')});out center tags;`
}

/**
 * Petición "con cobertura": empieza por el primer servidor y, si tarda o falla, lanza el siguiente
 * sin esperar. Gana el primero que responde bien; el resto se cancela.
 */
function hedgedQuery(query: string): Promise<OverpassElement[]> {
  return new Promise((resolve, reject) => {
    const controllers: AbortController[] = []
    const timers: number[] = []
    let next = 0
    let failures = 0
    let settled = false

    const stopAll = (): void => {
      timers.forEach((t) => window.clearTimeout(t))
      controllers.forEach((c) => c.abort())
    }

    const launch = (): void => {
      if (settled || next >= ENDPOINTS.length) return
      const endpoint = ENDPOINTS[next++]
      const controller = new AbortController()
      controllers.push(controller)
      timers.push(window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS))
      // Si este servidor tarda, se prueba el siguiente en paralelo
      if (next < ENDPOINTS.length) timers.push(window.setTimeout(launch, HEDGE_DELAY_MS))

      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) throw new Error(`Overpass ${res.status}`)
          const json = (await res.json()) as { elements?: OverpassElement[]; remark?: string }
          // Overpass responde 200 con un "remark" cuando se queda sin tiempo o memoria
          if (json.remark && !json.elements?.length) throw new Error(json.remark)
          return json.elements ?? []
        })
        .then((elements) => {
          if (settled) return
          settled = true
          stopAll()
          resolve(elements)
        })
        .catch((e: unknown) => {
          if (settled) return
          failures++
          if (failures >= ENDPOINTS.length) {
            settled = true
            stopAll()
            reject(e instanceof Error ? e : new Error('Overpass no responde'))
          } else {
            launch() // este falló: no esperes al temporizador
          }
        })
    }
    launch()
  })
}

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
 * desde Overpass → Overpass directo desde el móvil como último recurso.
 */
async function fetchFromNetwork(cell: string): Promise<Poi[]> {
  if (sharedCacheEnabled) {
    let shared: SharedCell | null = null
    try {
      shared = await readSharedCell(cell)
      if (shared && Date.now() - shared.fetchedAt < SHARED_FRESH_MS) return shared.pois
      shared = (await fillSharedCell(cell).catch(() => null)) ?? shared
      if (shared) return shared.pois // si Overpass falló, la función devuelve lo caducado
    } catch {
      /* Supabase caído: seguimos con Overpass directo */
    }
  }
  return parseElements(await hedgedQuery(buildCellQuery(cell)), new Set([cell]))
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

  const ring = toFetch.filter((c) => c !== center)
  if (toFetch.includes(center)) await fetchCell(center)
  const queue = [...ring]
  const worker = async (): Promise<void> => {
    for (let c = queue.shift(); c !== undefined; c = queue.shift()) await fetchCell(c)
  }
  await Promise.all(Array.from({ length: RING_CONCURRENCY }, worker))

  if (!haveData.has(center)) throw new Error('Sin datos del barrio')
  return { failedCells: [...failed], stale }
}
