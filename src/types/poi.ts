import type { LatLng } from './index'

/** Rol de un lugar real dentro del juego (GDD §3). */
export type PoiKind = 'warehouse' | 'pharmacy' | 'park' | 'nightlife' | 'police' | 'cover'

export interface Poi extends LatLng {
  /** Identificador estable de OSM, p. ej. "way/123" */
  id: string
  kind: PoiKind
  /** Texto fijo (sin uso: los nombres viajan como código en `nameId`) */
  name: string | null
  /** Código numérico del nombre inventado; se traduce en el cliente (data/poiNames) */
  nameId?: [venue: number, seed: number]
  /** Celda H3 (res. 8) a la que pertenece */
  cell: string
}

export interface CachedCell {
  fetchedAt: number
  pois: Poi[]
}
