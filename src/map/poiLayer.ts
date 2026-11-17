import type { Map as MlMap, GeoJSONSource } from 'maplibre-gl'
import type { Feature, FeatureCollection, Point, Polygon } from 'geojson'
import type { Poi } from '../types/poi'
import { POI_KINDS, POLICE_INFLUENCE_RADIUS_M } from '../data/poiKinds'

const POI_SOURCE = 'pois'
const POLICE_SOURCE = 'police-zones'

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
  const colorMatch: unknown[] = ['match', ['get', 'kind']]
  for (const [kind, info] of Object.entries(POI_KINDS)) colorMatch.push(kind, info.color)
  colorMatch.push('#999999')
  map.addLayer({
    id: 'poi-circles',
    type: 'circle',
    source: POI_SOURCE,
    paint: {
      'circle-color': colorMatch as never,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 5, 17, 11] as never,
      'circle-stroke-color': '#111111',
      'circle-stroke-width': 3,
    },
  })
}

/** Vuelca los POIs al mapa. */
export function setPois(map: MlMap, pois: Poi[]): void {
  const features: Feature<Point>[] = pois.map((p) => ({
    type: 'Feature',
    properties: { kind: p.kind, name: p.name ?? '' },
    geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
  }))
  ;(map.getSource(POI_SOURCE) as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features })

  const zones = pois
    .filter((p) => p.kind === 'police')
    .map((p) => circlePolygon(p.lng, p.lat, POLICE_INFLUENCE_RADIUS_M))
  ;(map.getSource(POLICE_SOURCE) as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: zones })
}
