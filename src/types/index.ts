export interface LatLng {
  lat: number
  lng: number
}

export interface GeoFix extends LatLng {
  /** Epoch ms de la lectura */
  timestamp: number
  /** Precisión horizontal en metros */
  accuracy: number
}

export type GpsStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'unavailable' | 'error'
