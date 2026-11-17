import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { Feature, Polygon } from 'geojson'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'

maplibregl.setWorkerUrl(workerUrl)
import { usePlayerStore } from '../store/playerStore'
import { INTERACTION_RADIUS_M } from '../services/geoService'
import { MAP_STYLE_URL, applyCartoonStyle } from './cartoonStyle'

const RADAR_SOURCE = 'radar'
const DEFAULT_CENTER: [number, number] = [-3.7038, 40.4168] // Madrid, hasta tener GPS

/** Polígono circular aproximado (metros → grados). */
function circle(lng: number, lat: number, radiusM: number): Feature<Polygon> {
  const pts: [number, number][] = []
  const dLat = radiusM / 111_320
  const dLng = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180))
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * 2 * Math.PI
    pts.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)])
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [pts] } }
}

interface Props {
  follow: boolean
}

export default function GameMap({ follow }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const followRef = useRef(follow)
  followRef.current = follow

  useEffect(() => {
    if (!container.current) return
    const map = new maplibregl.Map({
      container: container.current,
      style: MAP_STYLE_URL,
      center: DEFAULT_CENTER,
      zoom: 16,
      attributionControl: { compact: true },
    })
    let ready = false
    let centered = false

    const el = document.createElement('div')
    el.className = 'avatar'
    const marker = new maplibregl.Marker({ element: el })

    function update(lng: number, lat: number): void {
      marker.setLngLat([lng, lat]).addTo(map)
      if (ready) {
        ;(map.getSource(RADAR_SOURCE) as maplibregl.GeoJSONSource).setData(circle(lng, lat, INTERACTION_RADIUS_M))
      }
      if (!centered) {
        map.jumpTo({ center: [lng, lat], zoom: 17 })
        centered = true
      } else if (followRef.current) {
        map.easeTo({ center: [lng, lat], duration: 600 })
      }
    }

    map.on('load', () => {
      applyCartoonStyle(map)
      map.addSource(RADAR_SOURCE, { type: 'geojson', data: circle(0, 0, 1) })
      map.addLayer({
        id: 'radar-fill',
        type: 'fill',
        source: RADAR_SOURCE,
        paint: { 'fill-color': '#facc15', 'fill-opacity': 0.25 },
      })
      map.addLayer({
        id: 'radar-line',
        type: 'line',
        source: RADAR_SOURCE,
        paint: { 'line-color': '#111111', 'line-width': 3, 'line-dasharray': [2, 1] },
      })
      ready = true
      const p = usePlayerStore.getState().position
      if (p) update(p.lng, p.lat)
    })

    const unsub = usePlayerStore.subscribe((s, prev) => {
      if (s.position && s.position !== prev.position) update(s.position.lng, s.position.lat)
    })
    const initial = usePlayerStore.getState().position
    if (initial) update(initial.lng, initial.lat)

    return () => {
      unsub()
      map.remove()
    }
  }, [])

  return (
    <div className="absolute inset-0">
      <div ref={container} className="h-full w-full" />
    </div>
  )
}
