import type { GeoFix, LatLng } from '../types'

export const MAX_WALK_SPEED_KMH = 25
/** Histéresis: se desbloquea al bajar de este umbral */
export const RESUME_SPEED_KMH = 20
/** Radio de interacción con POIs y HQ. TEMPORAL para pruebas: 150 m (valor de diseño: 50 m) */
export const INTERACTION_RADIUS_M = 150

const EARTH_RADIUS_M = 6_371_000
const toRad = (d: number): number => (d * Math.PI) / 180

/** Distancia en metros entre dos puntos (Haversine). */
export function haversine(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

/** Velocidad en km/h entre dos lecturas; null si no es fiable. */
export function speedKmh(prev: GeoFix, next: GeoFix): number | null {
  const dt = (next.timestamp - prev.timestamp) / 1000
  if (dt < 0.5) return null
  const dist = haversine(prev, next)
  // Movimientos dentro del ruido del GPS cuentan como parado
  if (dist < Math.max(prev.accuracy, next.accuracy) * 0.5 && dist < 5) return 0
  return (dist / dt) * 3.6
}

/** Decide si el jugador va "al volante" aplicando histéresis. */
export function nextDrivingState(wasDriving: boolean, kmh: number | null): boolean {
  if (kmh === null) return wasDriving
  return wasDriving ? kmh > RESUME_SPEED_KMH : kmh > MAX_WALK_SPEED_KMH
}

export type GeoErrorKind = 'denied' | 'unavailable' | 'error'

export interface WatchHandle {
  stop: () => void
}

export function isGeolocationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator
}

/** Wrapper de watchPosition. */
export function watchPlayer(
  onFix: (fix: GeoFix) => void,
  onError: (kind: GeoErrorKind) => void,
): WatchHandle {
  if (!isGeolocationSupported()) {
    onError('unavailable')
    return { stop: () => undefined }
  }
  const id = navigator.geolocation.watchPosition(
    (p) =>
      onFix({
        lat: p.coords.latitude,
        lng: p.coords.longitude,
        accuracy: p.coords.accuracy,
        timestamp: p.timestamp,
      }),
    (e) =>
      onError(
        e.code === e.PERMISSION_DENIED ? 'denied' : e.code === e.POSITION_UNAVAILABLE ? 'unavailable' : 'error',
      ),
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
  )
  return { stop: () => navigator.geolocation.clearWatch(id) }
}
