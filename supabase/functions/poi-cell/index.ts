// Edge Function (Deno): rellena la caché compartida de POIs de una celda H3.
// Solo se invoca cuando la celda falta o está caducada; las lecturas van directas a la tabla.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { cellToBoundary, isValidCell, getResolution, latLngToCell } from 'npm:h3-js@4'

const H3_RES = 8
const BBOX_MARGIN = 0.0005
const TTL_MS = 14 * 24 * 60 * 60 * 1000 // OSM cambia despacio
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]
const USER_AGENT = 'CartelGO-poi-cache/1.0 (juego de ficcion; cache compartida por celda H3)'
const SELECTORS = [
  '["amenity"~"^(pharmacy|bar|nightclub|police|car_wash)$"]',
  '["shop"~"^(laundry|car_wash)$"]',
  '["leisure"="park"]',
  '["landuse"="industrial"]',
]

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Kind = 'warehouse' | 'pharmacy' | 'park' | 'nightlife' | 'police' | 'cover'
interface Element {
  type: string
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

// OJO: misma clasificación que src/services/osmService.ts (classify). Mantener sincronizadas.
function classify(t: Record<string, string>): Kind | null {
  if (t.amenity === 'police') return 'police'
  if (t.amenity === 'pharmacy') return 'pharmacy'
  if (t.amenity === 'bar' || t.amenity === 'nightclub') return 'nightlife'
  if (t.shop === 'laundry' || t.shop === 'car_wash' || t.amenity === 'car_wash') return 'cover'
  if (t.leisure === 'park') return 'park'
  if (t.landuse === 'industrial') return 'warehouse'
  return null
}

function buildQuery(cell: string): string {
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
  return `[out:json][timeout:25];(${SELECTORS.map((s) => `nwr${s}(${bbox});`).join('')});out center tags;`
}

async function overpass(query: string): Promise<Element[]> {
  // En paralelo con salida escalonada: gana el primero que responde bien
  const attempt = async (endpoint: string, i: number): Promise<Element[]> => {
    await new Promise((r) => setTimeout(r, i * 2_000))
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(40_000),
      })
      if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 80).replace(/\s+/g, ' ')}`)
      const json = (await res.json()) as { elements?: Element[]; remark?: string }
      if (json.remark && !json.elements?.length) throw new Error(json.remark)
      return json.elements ?? []
    } catch (e) {
      throw new Error(`${new URL(endpoint).host}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  try {
    return await Promise.any(ENDPOINTS.map(attempt))
  } catch (e) {
    const errs = (e as AggregateError).errors?.map((x: Error) => x.message) ?? [String(e)]
    throw new Error(errs.join(' | '))
  }
}

function toPois(elements: Element[], cell: string) {
  const out = new Map<string, unknown>()
  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat
    const lng = el.lon ?? el.center?.lon
    if (lat === undefined || lng === undefined || !el.tags) continue
    const kind = classify(el.tags)
    if (!kind || latLngToCell(lat, lng, H3_RES) !== cell) continue
    const id = `${el.type}/${el.id}`
    out.set(id, { id, kind, name: el.tags.name ?? null, lat, lng, cell })
  }
  return [...out.values()]
}

// Una sola petición a Overpass por celda dentro de la misma instancia
const inflight = new Map<string, Promise<{ fetched_at: string; pois: unknown[] }>>()

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
  if (row && Date.now() - new Date(row.fetched_at).getTime() < TTL_MS) return json(row)

  let job = inflight.get(cell)
  if (!job) {
    job = (async () => {
      const pois = toPois(await overpass(buildQuery(cell)), cell)
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
    // Si Overpass falla pero había datos caducados, es mejor servirlos que nada
    if (row) return json({ ...row, stale: true })
    return json({ error: e instanceof Error ? e.message : 'Overpass no responde' }, 502)
  }
})
