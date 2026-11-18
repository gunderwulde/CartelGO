import { VectorTile } from '@mapbox/vector-tile'
import { PbfReader } from 'pbf'
import { cellToBoundary, latLngToCell } from 'h3-js'
import type { Poi, PoiKind } from '../types/poi'
import { haversine } from './geoService'

/**
 * POIs a partir de las teselas vectoriales de OpenFreeMap (esquema OpenMapTiles, datos de OSM).
 * Mismas teselas que dibuja el mapa: llegan por CDN, rápido y sin los cuellos de botella de Overpass.
 * La función de borde (supabase/functions/poi-cell) tiene una copia de esta lógica: mantener sincronizadas.
 */
const TILEJSON_URL = 'https://tiles.openfreemap.org/planet'
/** A z14 las teselas traen todos los POIs; es el zoom máximo del servicio */
export const TILE_ZOOM = 14
const TILE_TIMEOUT_MS = 15_000
const CELL_RES = 8

/** Rol del juego según clase/subclase del layer `poi` de OpenMapTiles; null si no interesa. */
export function classifyPoi(cls: string, subclass: string): PoiKind | null {
  if (cls === 'police') return 'police'
  if (cls === 'pharmacy') return 'pharmacy'
  if (cls === 'bar' || cls === 'nightclub' || subclass === 'pub' || subclass === 'nightclub') return 'nightlife'
  if (cls === 'park') return 'park'
  if (cls === 'laundry' || cls === 'car_wash' || subclass === 'car_wash' || subclass === 'laundry') return 'cover'
  return null
}

export interface TileCoord {
  x: number
  y: number
}

const lngToTileX = (lng: number, z: number): number => Math.floor(((lng + 180) / 360) * 2 ** z)
const latToTileY = (lat: number, z: number): number => {
  const r = (lat * Math.PI) / 180
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z)
}

/** Teselas que cubren una celda H3 (normalmente 1 o 2 de ancho por 1 o 2 de alto). */
export function tilesForCell(cell: string, z = TILE_ZOOM): TileCoord[] {
  const pts = cellToBoundary(cell)
  const lats = pts.map((p) => p[0])
  const lngs = pts.map((p) => p[1])
  const x0 = lngToTileX(Math.min(...lngs), z)
  const x1 = lngToTileX(Math.max(...lngs), z)
  const y0 = latToTileY(Math.max(...lats), z)
  const y1 = latToTileY(Math.min(...lats), z)
  const out: TileCoord[] = []
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push({ x, y })
  return out
}

/** Coordenada dentro de una tesela (0..extent) → lat/lng. */
export function tilePointToLatLng(z: number, x: number, y: number, px: number, py: number, extent: number): { lat: number; lng: number } {
  const n = 2 ** z
  const lng = ((x + px / extent) / n) * 360 - 180
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + py / extent)) / n))) * 180) / Math.PI
  return { lat, lng }
}

const round = (n: number): string => n.toFixed(4)

/**
 * Máximo de POIs por tipo y celda. Las zonas muy densas (centro de Madrid: ~150 bares en una celda)
 * saturan el mapa, la lista y la economía; se queda una muestra repartida por la celda.
 * La función de borde tiene una copia de estos valores: mantener sincronizados.
 */
export const MAX_PER_KIND: Record<PoiKind, number> = {
  police: 6,
  pharmacy: 6,
  nightlife: 10,
  park: 6,
  cover: 4,
  warehouse: 4,
}
/** Separación mínima entre dos POIs del mismo tipo (m): evita montones de iconos solapados */
export const MIN_SEPARATION_M = 60

export interface Candidate {
  poi: Poi
  /** Importancia en OpenMapTiles (menor = más importante) */
  rank: number
}

/**
 * Elige de forma determinista qué POIs se quedan: primero los que tienen nombre, luego los más importantes,
 * y se descartan los que quedan a menos de MIN_SEPARATION_M de otro ya elegido del mismo tipo.
 * El resultado no depende del orden de entrada, así servidor y móvil obtienen lo mismo.
 */
export function selectPois(candidates: Candidate[]): Poi[] {
  const byKind = new Map<PoiKind, Candidate[]>()
  for (const c of candidates) byKind.set(c.poi.kind, [...(byKind.get(c.poi.kind) ?? []), c])
  const out: Poi[] = []
  for (const [kind, list] of byKind) {
    list.sort(
      (a, b) =>
        Number(b.poi.name !== null) - Number(a.poi.name !== null) ||
        a.rank - b.rank ||
        (a.poi.id < b.poi.id ? -1 : a.poi.id > b.poi.id ? 1 : 0),
    )
    const chosen: Poi[] = []
    for (const { poi } of list) {
      if (chosen.length >= MAX_PER_KIND[kind]) break
      if (chosen.some((c) => haversine(c, poi) < MIN_SEPARATION_M)) continue
      chosen.push(poi)
    }
    out.push(...chosen)
  }
  return out
}

/** Extrae los candidatos de una tesela que caen dentro de alguna de las celdas pedidas. */
export function poisFromTile(tile: VectorTile, z: number, x: number, y: number, cells: Set<string>): Candidate[] {
  const out = new Map<string, Candidate>()

  const add = (kind: PoiKind, name: unknown, lat: number, lng: number, osmId: number | undefined, tag: string, rank: unknown): void => {
    const cell = latLngToCell(lat, lng, CELL_RES)
    if (!cells.has(cell)) return
    const id = osmId !== undefined ? `vt/${osmId}` : `vt/${tag}/${round(lat)},${round(lng)}`
    const poi: Poi = { id, kind, name: typeof name === 'string' && name ? name : null, lat, lng, cell }
    out.set(id, { poi, rank: typeof rank === 'number' ? rank : 99 })
  }

  const poi = tile.layers.poi
  if (poi) {
    for (let i = 0; i < poi.length; i++) {
      const f = poi.feature(i)
      const kind = classifyPoi(String(f.properties.class ?? ''), String(f.properties.subclass ?? ''))
      if (!kind) continue
      const pt = f.loadGeometry()[0]?.[0]
      if (!pt) continue
      const { lat, lng } = tilePointToLatLng(z, x, y, pt.x, pt.y, f.extent)
      add(kind, f.properties.name, lat, lng, f.id, kind, f.properties.rank)
    }
  }

  // Las zonas industriales vienen como polígonos (recortados por la tesela): se usa el centro de su caja
  const landuse = tile.layers.landuse
  if (landuse) {
    for (let i = 0; i < landuse.length; i++) {
      const f = landuse.feature(i)
      if (f.properties.class !== 'industrial') continue
      const ring = f.loadGeometry()[0]
      if (!ring?.length) continue
      const xs = ring.map((p) => p.x)
      const ys = ring.map((p) => p.y)
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2
      const cy = (Math.min(...ys) + Math.max(...ys)) / 2
      const { lat, lng } = tilePointToLatLng(z, x, y, cx, cy, f.extent)
      add('warehouse', f.properties.name, lat, lng, undefined, 'industrial', 99)
    }
  }
  return [...out.values()]
}

let templatePromise: Promise<string> | null = null

/** La URL de las teselas lleva la versión del planeta; se pide una vez por sesión. */
function tileTemplate(): Promise<string> {
  templatePromise ??= fetch(TILEJSON_URL, { signal: AbortSignal.timeout(TILE_TIMEOUT_MS) })
    .then(async (res) => {
      if (!res.ok) throw new Error(`TileJSON ${res.status}`)
      const tj = (await res.json()) as { tiles?: string[] }
      const t = tj.tiles?.[0]
      if (!t) throw new Error('TileJSON sin teselas')
      return t
    })
    .catch((e: unknown) => {
      templatePromise = null // reintentable
      throw e
    })
  return templatePromise
}

/** POIs de una celda H3 res. 8 leyendo directamente las teselas vectoriales. */
export async function fetchCellPoisFromTiles(cell: string): Promise<Poi[]> {
  const template = await tileTemplate()
  const cells = new Set([cell])
  const all = await Promise.all(
    tilesForCell(cell).map(async ({ x, y }) => {
      const url = template.replace('{z}', String(TILE_ZOOM)).replace('{x}', String(x)).replace('{y}', String(y))
      const res = await fetch(url, { signal: AbortSignal.timeout(TILE_TIMEOUT_MS) })
      if (res.status === 404) return [] // teselas vacías (mar, desierto)
      if (!res.ok) throw new Error(`Tesela ${res.status}`)
      const tile = new VectorTile(new PbfReader(new Uint8Array(await res.arrayBuffer())))
      return poisFromTile(tile, TILE_ZOOM, x, y, cells)
    }),
  )
  const merged = new Map<string, Candidate>()
  for (const c of all.flat()) merged.set(c.poi.id, c)
  return selectPois([...merged.values()])
}
