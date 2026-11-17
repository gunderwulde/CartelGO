import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'

maplibregl.setWorkerUrl(workerUrl)
import { usePlayerStore } from '../store/playerStore'
import { INTERACTION_RADIUS_M } from '../services/geoService'
import { useMapStore } from '../store/mapStore'
import { useBaseStore } from '../store/baseStore'
import { addPoiLayers, circlePolygon, setPois } from './poiLayer'
import { MAP_STYLE_URL, applyCartoonStyle } from './cartoonStyle'

const RADAR_SOURCE = 'radar'
const DEFAULT_CENTER: [number, number] = [-3.7038, 40.4168] // Madrid, hasta tener GPS

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

    const hqEl = document.createElement('div')
    hqEl.className = 'hq-marker'
    hqEl.textContent = '🏠'
    const hqMarker = new maplibregl.Marker({ element: hqEl })
    const showHq = (hq: { lat: number; lng: number } | null): void => {
      if (hq) hqMarker.setLngLat([hq.lng, hq.lat]).addTo(map)
      else hqMarker.remove()
    }
    showHq(useBaseStore.getState().hq)
    const unsubHq = useBaseStore.subscribe((s, prev) => {
      if (s.hq !== prev.hq) showHq(s.hq)
    })

    function update(lng: number, lat: number): void {
      marker.setLngLat([lng, lat]).addTo(map)
      if (ready) {
        ;(map.getSource(RADAR_SOURCE) as maplibregl.GeoJSONSource).setData(circlePolygon(lng, lat, INTERACTION_RADIUS_M))
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
      map.addSource(RADAR_SOURCE, { type: 'geojson', data: circlePolygon(0, 0, 1) })
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
      addPoiLayers(map)
      setPois(map, Object.values(useMapStore.getState().pois))
      ready = true
      const p = usePlayerStore.getState().position
      if (p) update(p.lng, p.lat)
    })

    const unsub = usePlayerStore.subscribe((s, prev) => {
      if (s.position && s.position !== prev.position) update(s.position.lng, s.position.lat)
    })
    const unsubPois = useMapStore.subscribe((s, prev) => {
      if (ready && s.pois !== prev.pois) setPois(map, Object.values(s.pois))
    })
    const initial = usePlayerStore.getState().position
    if (initial) update(initial.lng, initial.lat)

    return () => {
      unsub()
      unsubPois()
      unsubHq()
      map.remove()
    }
  }, [])

  return (
    <div className="absolute inset-0">
      <div ref={container} className="h-full w-full" />
    </div>
  )
}
