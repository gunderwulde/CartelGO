import type { Carrier } from '../services/supplyEngine'
import { carrierInfo } from '../services/supplyEngine'

interface LatLng {
  lat: number
  lng: number
}

export interface CarPose extends LatLng {
  /** Va cargado (de vuelta al HQ) */
  loaded: boolean
  /** Avanza hacia el este (para girar el dibujo) */
  east: boolean
}

/**
 * Posición visual de un transportista en viaje: la primera mitad va del HQ al punto de recogida
 * y la segunda vuelve cargado. Solo es una simulación en línea recta para dar vida al mapa;
 * la lógica real (tiempos) sigue en supplyEngine.
 */
export function carPose(carrier: Carrier, point: LatLng, hq: LatLng, now: number): CarPose | null {
  const trip = carrier.trip
  if (!trip) return null
  const total = carrierInfo(carrier.level).tripMs
  const progress = Math.min(1, Math.max(0, 1 - (trip.arriveAt - now) / total))
  const out = progress < 0.5
  const t = out ? progress * 2 : (progress - 0.5) * 2
  const from = out ? hq : point
  const to = out ? point : hq
  return {
    lat: from.lat + (to.lat - from.lat) * t,
    lng: from.lng + (to.lng - from.lng) * t,
    loaded: !out,
    east: to.lng >= from.lng,
  }
}
