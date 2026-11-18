import type { Map as MlMap, GeoJSONSource } from 'maplibre-gl'
import type { Feature, FeatureCollection, Point, Polygon } from 'geojson'
import type { Poi } from '../types/poi'
import { POLICE_INFLUENCE_RADIUS_M } from '../data/poiKinds'
import { registerPoiIcons } from './poiIcons'

const POI_SOURCE = 'pois'
const POLICE_SOURCE = 'police-zones'

/** Actividad del jugador en un lugar: se resalta con un aro de color */
export type PoiActivity = 'deal' | 'dealer' | 'prep' | 'transit'

interface ActivityInput {
  dealers: { poiId: string }[]
  businesses?: { poiId: string }[]
  suppliers: Record<string, { order: unknown }>
  carriers: { trip: { supplierId: string } | null }[]
}

/**
 * Lugares con los que tienes trato: proveedor con contacto o negocio propio (aro blanco), camello (verde),
 * pedido preparándose (amarillo) o transportista en camino (azul). El resto se ve atenuado.
 */
export function poiActivities({ dealers, businesses = [], suppliers, carriers }: ActivityInput): Record<string, PoiActivity> {
  const out: Record<string, PoiActivity> = {}
  for (const b of businesses) out[b.poiId] = 'deal'
  for (const id of Object.keys(suppliers)) out[id] = 'deal'
  for (const d of dealers) out[d.poiId] = 'dealer'
  for (const [id, sup] of Object.entries(suppliers)) if (sup.order) out[id] = 'prep'
  for (const c of carriers) if (c.trip) out[c.trip.supplierId] = 'transit'
  return out
}

export function circlePolygon(lng: number, lat: number, radiusM: number): Feature<Polygon> {
  const pts: [number, number][] = []
  const dLat = radiusM / 111_320
  const dLng = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180))
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * 2 * Math.PI
    pts.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)])
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [pts] } }
}

const empty = <G extends Point | Polygon>(): FeatureCollection<G> => ({ type: 'FeatureCollection', features: [] })

/** Añade las capas de POIs y zonas de comisaría. Llamar una vez tras cargar el estilo. */
export function addPoiLayers(map: MlMap): void {
  map.addSource(POLICE_SOURCE, { type: 'geojson', data: empty<Polygon>() })
  map.addLayer({
    id: 'police-fill',
    type: 'fill',
    source: POLICE_SOURCE,
    paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.18 },
  })
  map.addLayer({
    id: 'police-line',
    type: 'line',
    source: POLICE_SOURCE,
    paint: { 'line-color': '#1d4ed8', 'line-width': 2, 'line-dasharray': [1, 1.5] },
  })

  map.addSource(POI_SOURCE, { type: 'geojson', data: empty<Point>() })
  map.addLayer({
    id: 'poi-activity',
    type: 'circle',
    source: POI_SOURCE,
    filter: ['!=', ['get', 'activity'], ''],
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 14, 16, 22, 18, 28],
      'circle-color': ['match', ['get', 'activity'], 'deal', '#ffffff', 'dealer', '#4ade80', 'prep', '#facc15', '#38bdf8'],
      'circle-opacity': 0.55,
      'circle-stroke-width': 4,
      'circle-stroke-color': ['match', ['get', 'activity'], 'deal', '#111111', 'dealer', '#16a34a', 'prep', '#ca8a04', '#0284c7'],
    },
  })
  map.addLayer({
    id: 'poi-icons',
    type: 'symbol',
    source: POI_SOURCE,
    layout: {
      'icon-image': ['concat', 'poi-', ['get', 'kind']],
      'icon-size': ['interpolate', ['linear'], ['zoom'], 13, 0.5, 16, 0.8, 18, 1],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
    // Sin trato: más tenue (la policía no admite trato y se ve siempre igual)
    paint: {
      'icon-opacity': ['case', ['any', ['!=', ['get', 'activity'], ''], ['==', ['get', 'kind'], 'police']], 1, 0.55],
    },
  })
  // Las insignias se dibujan en un canvas (async); la capa las muestra en cuanto estén registradas
  void registerPoiIcons(map)
}

/** Id de la capa de iconos (para escuchar los toques) */
export const POI_ICON_LAYER = 'poi-icons'

/** Vuelca los POIs al mapa. */
export function setPois(map: MlMap, pois: Poi[], activities: Record<string, PoiActivity> = {}): void {
  const features: Feature<Point>[] = pois.map((p) => ({
    type: 'Feature',
    properties: { id: p.id, kind: p.kind, name: p.name ?? '', activity: activities[p.id] ?? '' },
    geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
  }))
  ;(map.getSource(POI_SOURCE) as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features })

  const zones = pois
    .filter((p) => p.kind === 'police')
    .map((p) => circlePolygon(p.lng, p.lat, POLICE_INFLUENCE_RADIUS_M))
  ;(map.getSource(POLICE_SOURCE) as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: zones })
}
