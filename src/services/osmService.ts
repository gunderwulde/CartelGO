import { cellToBoundary, gridDisk, latLngToCell } from 'h3-js'
import { get, set } from 'idb-keyval'
import type { LatLng } from '../types'
import type { CachedCell, Poi, PoiKind } from '../types/poi'

/** Resolución H3: ~0.7 km² por celda (la misma que el territorio de la Fase 2). */
export const H3_RES = 8
/** Margen del bbox (grados) para no perder POIs que caen justo en el borde. */
const BBOX_MARGIN = 0.0005
const REQUEST_TIMEOUT_MS = 20_000
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

/** Etiquetas OSM de cada rol del juego. */
const SELECTORS = [
  '["landuse"="industrial"]',
  '["amenity"="pharmacy"]',
  '["leisure"="park"]',
  '["amenity"~"^(bar|nightclub)$"]',
  '["amenity"="police"]',
  '["shop"~"^(laundry|car_wash)$"]',
  '["amenity"="car_wash"]',
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

/** Una sola consulta por bbox (mucho más barata para Overpass que un around por celda). */
function buildQuery(cells: string[]): string {
  let south = 90
  let north = -90
  let west = 180
  let east = -180
  for (const c of cells) {
    for (const [lat, lng] of cellToBoundary(c)) {
      south = Math.min(south, lat)
      north = Math.max(north, lat)
      west = Math.min(west, lng)
      east = Math.max(east, lng)
    }
  }
  const bbox = [south - BBOX_MARGIN, west - BBOX_MARGIN, north + BBOX_MARGIN, east + BBOX_MARGIN]
    .map((n) => n.toFixed(5))
    .join(',')
  const parts = SELECTORS.map((sel) => `nwr${sel}(${bbox});`)
  return `[out:json][timeout:25];(${parts.join('')});out center tags;`
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** Pide a Overpass con reintentos, backoff y endpoint alternativo. */
async function queryOverpass(query: string): Promise<OverpassElement[]> {
  let lastError: unknown = null
  for (let attempt = 0; attempt < ENDPOINTS.length * 2; attempt++) {
    const endpoint = ENDPOINTS[attempt % ENDPOINTS.length]
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (!res.ok) throw new Error(`Overpass ${res.status}`)
      const json = (await res.json()) as { elements?: OverpassElement[] }
      return json.elements ?? []
    } catch (e) {
      lastError = e
      await sleep(500 * (attempt + 1))
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Overpass no responde')
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

/** Celdas que rodean al jugador (la suya + anillo de 1). */
export function cellsAround(pos: LatLng): string[] {
  return gridDisk(latLngToCell(pos.lat, pos.lng, H3_RES), 1)
}

/**
 * Devuelve los POIs de las celdas cercanas. Solo consulta Overpass por las celdas que
 * no están en caché o han caducado; nunca por movimiento de GPS.
 */
export async function loadPoisAround(pos: LatLng, now = Date.now()): Promise<Poi[]> {
  const cells = cellsAround(pos)
  const result: Poi[] = []
  const missing: string[] = []

  for (const c of cells) {
    const cached = await readCache(c)
    if (cached && now - cached.fetchedAt < CACHE_TTL_MS) result.push(...cached.pois)
    else missing.push(c)
  }

  if (missing.length > 0) {
    const elements = await queryOverpass(buildQuery(missing))
    const fresh = parseElements(elements, new Set(missing))
    for (const c of missing) {
      await writeCache(c, { fetchedAt: now, pois: fresh.filter((p) => p.cell === c) })
    }
    result.push(...fresh)
  }
  return result
}
