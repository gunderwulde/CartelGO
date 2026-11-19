// Edge Function (Deno): rellena la caché compartida de POIs de una celda H3.
// Lee las teselas vectoriales de OpenFreeMap (datos OSM). Solo se invoca cuando la celda falta;
// las lecturas van directas a la tabla. Las celdas no caducan.
// OJO: la lógica de teselas y de selección es una copia de src/services/tilePois.ts. Mantener sincronizadas.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { VectorTile } from 'npm:@mapbox/vector-tile@3'
import { PbfReader } from 'npm:pbf@5'
import { cellToBoundary, isValidCell, getResolution, latLngToCell } from 'npm:h3-js@4'

const H3_RES = 8
const Z = 14
const TILEJSON_URL = 'https://tiles.openfreemap.org/planet'
const TILE_TIMEOUT_MS = 15_000

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Kind = 'warehouse' | 'pharmacy' | 'supermarket' | 'park' | 'nightlife' | 'police' | 'cover'

// ---- Copia de src/data/poiNameCode.ts (código numérico de los nombres). Mantener sincronizadas. ----
/**
 * Código numérico del nombre de un lugar. El servidor (función de borde poi-cell) guarda en la caché
 * compartida SOLO este código, no texto: cada cliente lo traduce a su idioma (ver poiNames.ts), así que
 * todos ven el mismo lugar con el mismo nombre en su idioma y se pueden añadir idiomas sin tocar el servidor.
 * Sin imports a propósito: la función de borde tiene una copia literal de este fichero. Mantener sincronizadas.
 *
 * [tipo de local, semilla]: el tipo es el índice+1 en VENUES (0 = sin tipo conocido) y la semilla sale del id.
 */
type NameId = [venue: number, seed: number];

/** Tipos de local del mapa con tema propio. Solo se puede AÑADIR al final: el orden forma parte de la caché. */
const VENUES = [
  "laundry",
  "dry_cleaning",
  "car_wash",
  "car_repair",
  "hairdresser",
  "beauty",
  "florist",
  "bakery",
  "butcher",
  "convenience",
  "kiosk",
  "fast_food",
  "cafe",
  "restaurant",
  "ice_cream",
  "bookstore",
  "clothing_store",
  "bar",
  "pub",
  "nightclub",
  "supermarket",
];

/** Tipo de local que usamos como tema: la clase del mapa o, si no la conocemos, la subclase. */
function venueOf(cls: string, subclass: string): string {
  return VENUES.includes(cls) ? cls : VENUES.includes(subclass) ? subclass : "";
}

/** Número entero estable (0..2^32-1) a partir de un texto (FNV-1a). */
function hash32(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Código del nombre de un lugar a partir de su id y de su tipo de local ("" si no tiene). */
function nameCode(id: string, venue: string): NameId {
  return [venue ? VENUES.indexOf(venue) + 1 : 0, hash32(id)];
}

// ---- Fin de la copia ----

interface Poi {
  id: string
  kind: Kind
  name: string | null
  nameId: NameId
  lat: number
  lng: number
  cell: string
}
interface Candidate {
  poi: Poi
  rank: number
  named?: boolean
}

// Límite por tipo y celda (zonas muy densas saturan mapa y economía)
const MAX_PER_KIND: Record<Kind, number> = { police: 6, pharmacy: 6, supermarket: 6, nightlife: 10, park: 6, cover: 12, warehouse: 4 }
const MIN_SEPARATION_M = 60

const COVER_CLASSES = new Set([
  'laundry', 'dry_cleaning', 'car_wash', 'car_repair', 'hairdresser', 'beauty', 'florist', 'bakery', 'butcher',
  'convenience', 'kiosk', 'fast_food', 'cafe', 'restaurant', 'ice_cream', 'bookstore', 'clothing_store',
])

function classifyPoi(cls: string, subclass: string): Kind | null {
  if (cls === 'police') return 'police'
  if (cls === 'pharmacy') return 'pharmacy'
  if (cls === 'supermarket' || subclass === 'supermarket') return 'supermarket'
  if (cls === 'bar' || cls === 'nightclub' || subclass === 'pub' || subclass === 'nightclub') return 'nightlife'
  if (cls === 'park') return 'park'
  if (COVER_CLASSES.has(cls) || COVER_CLASSES.has(subclass)) return 'cover'
  return null
}

const toRad = (d: number): number => (d * Math.PI) / 180
function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h))
}

// Determinista: reparto por rondas de tipos, cada elegido el más alejado de todos los ya elegidos;
// a igual lejanía, con nombre primero, luego más importante, luego por id; separación mínima por tipo
const SPREAD_STEP_M = 25

const byPriority = (a: Candidate, b: Candidate): number =>
  Number(b.named ?? b.poi.name !== null) - Number(a.named ?? a.poi.name !== null) ||
  a.rank - b.rank ||
  (a.poi.id < b.poi.id ? -1 : a.poi.id > b.poi.id ? 1 : 0)

function selectPois(candidates: Candidate[]): Poi[] {
  const byKind = new Map<Kind, Candidate[]>()
  for (const c of candidates) byKind.set(c.poi.kind, [...(byKind.get(c.poi.kind) ?? []), c])
  const kinds = [...byKind.keys()].sort(
    (a, b) => (byKind.get(a)?.length ?? 0) - (byKind.get(b)?.length ?? 0) || (a < b ? -1 : 1),
  )
  for (const list of byKind.values()) list.sort(byPriority)

  const chosen: Poi[] = []
  const perKind = new Map<Kind, Poi[]>()
  const done = new Set<Kind>()
  while (done.size < kinds.length) {
    for (const kind of kinds) {
      if (done.has(kind)) continue
      const mine = perKind.get(kind) ?? []
      if (mine.length >= MAX_PER_KIND[kind]) {
        done.add(kind)
        continue
      }
      let best: Poi | null = null
      let bestBucket = -1
      for (const { poi } of byKind.get(kind) ?? []) {
        if (mine.some((c) => haversine(c, poi) < MIN_SEPARATION_M)) continue
        let nearest = Infinity
        for (const c of chosen) nearest = Math.min(nearest, haversine(c, poi))
        const bucket = Math.floor(nearest / SPREAD_STEP_M)
        if (bucket > bestBucket) {
          best = poi
          bestBucket = bucket
        }
      }
      if (!best) {
        done.add(kind)
        continue
      }
      chosen.push(best)
      perKind.set(kind, [...mine, best])
    }
  }
  return chosen
}

const lngToTileX = (lng: number): number => Math.floor(((lng + 180) / 360) * 2 ** Z)
const latToTileY = (lat: number): number => {
  const r = (lat * Math.PI) / 180
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** Z)
}

function tilesForCell(cell: string): { x: number; y: number }[] {
  const pts = cellToBoundary(cell)
  const lats = pts.map((p: number[]) => p[0])
  const lngs = pts.map((p: number[]) => p[1])
  const out: { x: number; y: number }[] = []
  for (let x = lngToTileX(Math.min(...lngs)); x <= lngToTileX(Math.max(...lngs)); x++) {
    for (let y = latToTileY(Math.max(...lats)); y <= latToTileY(Math.min(...lats)); y++) out.push({ x, y })
  }
  return out
}

function tilePointToLatLng(x: number, y: number, px: number, py: number, extent: number) {
  const n = 2 ** Z
  const lng = ((x + px / extent) / n) * 360 - 180
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + py / extent)) / n))) * 180) / Math.PI
  return { lat, lng }
}

function poisFromTile(tile: VectorTile, x: number, y: number, cell: string): Candidate[] {
  const out = new Map<string, Candidate>()
  const add = (kind: Kind, name: unknown, lat: number, lng: number, osmId: number | undefined, tag: string, rank: unknown, venue = '') => {
    if (latLngToCell(lat, lng, H3_RES) !== cell) return
    const id = osmId !== undefined ? `vt/${osmId}` : `vt/${tag}/${lat.toFixed(4)},${lng.toFixed(4)}`
    const poi: Poi = { id, kind, name: null, nameId: nameCode(id, venue), lat, lng, cell }
    out.set(id, { poi, rank: typeof rank === 'number' ? rank : 99, named: typeof name === 'string' && name !== '' })
  }
  const poi = tile.layers.poi
  if (poi) {
    for (let i = 0; i < poi.length; i++) {
      const f = poi.feature(i)
      const kind = classifyPoi(String(f.properties.class ?? ''), String(f.properties.subclass ?? ''))
      const pt = kind ? f.loadGeometry()[0]?.[0] : undefined
      if (!kind || !pt) continue
      const { lat, lng } = tilePointToLatLng(x, y, pt.x, pt.y, f.extent)
      add(kind, f.properties.name, lat, lng, f.id, kind, f.properties.rank, venueOf(String(f.properties.class ?? ''), String(f.properties.subclass ?? '')))
    }
  }
  const landuse = tile.layers.landuse
  if (landuse) {
    for (let i = 0; i < landuse.length; i++) {
      const f = landuse.feature(i)
      if (f.properties.class !== 'industrial') continue
      const ring = f.loadGeometry()[0]
      if (!ring?.length) continue
      const xs = ring.map((p: { x: number }) => p.x)
      const ys = ring.map((p: { y: number }) => p.y)
      const { lat, lng } = tilePointToLatLng(
        x,
        y,
        (Math.min(...xs) + Math.max(...xs)) / 2,
        (Math.min(...ys) + Math.max(...ys)) / 2,
        f.extent,
      )
      add('warehouse', f.properties.name, lat, lng, undefined, 'industrial', 99)
    }
  }
  return [...out.values()]
}

async function fetchCellPois(cell: string): Promise<Poi[]> {
  const tj = await fetch(TILEJSON_URL, { signal: AbortSignal.timeout(TILE_TIMEOUT_MS) })
  if (!tj.ok) throw new Error(`TileJSON ${tj.status}`)
  const template = ((await tj.json()) as { tiles?: string[] }).tiles?.[0]
  if (!template) throw new Error('TileJSON sin teselas')
  const all = await Promise.all(
    tilesForCell(cell).map(async ({ x, y }) => {
      const url = template.replace('{z}', String(Z)).replace('{x}', String(x)).replace('{y}', String(y))
      const res = await fetch(url, { signal: AbortSignal.timeout(TILE_TIMEOUT_MS) })
      if (res.status === 404) return []
      if (!res.ok) throw new Error(`Tesela ${res.status}`)
      return poisFromTile(new VectorTile(new PbfReader(new Uint8Array(await res.arrayBuffer()))), x, y, cell)
    }),
  )
  const merged = new Map<string, Candidate>()
  for (const c of all.flat()) merged.set(c.poi.id, c)
  return selectPois([...merged.values()])
}

// Una sola lectura de teselas por celda dentro de la misma instancia
const inflight = new Map<string, Promise<{ fetched_at: string; pois: Poi[] }>>()

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

  let cell: unknown
  try {
    cell = ((await req.json()) as { cell?: unknown }).cell
  } catch {
    return json({ error: 'JSON invalido' }, 400)
  }
  if (typeof cell !== 'string' || !isValidCell(cell) || getResolution(cell) !== H3_RES) {
    return json({ error: 'celda H3 res. 8 invalida' }, 400)
  }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: row } = await db.from('poi_cells').select('fetched_at,pois').eq('cell', cell).maybeSingle()
  if (row) return json(row) // las celdas no caducan

  let job = inflight.get(cell)
  if (!job) {
    job = (async () => {
      const pois = await fetchCellPois(cell as string)
      const fetched_at = new Date().toISOString()
      const { error } = await db.from('poi_cells').upsert({ cell, fetched_at, pois })
      if (error) throw new Error(error.message)
      return { fetched_at, pois }
    })().finally(() => inflight.delete(cell as string))
    inflight.set(cell, job)
  }
  try {
    return json(await job)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'No se pudieron leer las teselas' }, 502)
  }
})
