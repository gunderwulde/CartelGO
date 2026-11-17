import { create } from 'zustand'
import type { GeoFix, GpsStatus } from '../types'
import { nextDrivingState, speedKmh } from '../services/geoService'

interface PlayerState {
  position: GeoFix | null
  gpsStatus: GpsStatus
  speed: number
  /** true si va demasiado rápido: calle bloqueada */
  driving: boolean
  simulation: boolean
  setStatus: (s: GpsStatus) => void
  setSimulation: (on: boolean) => void
  pushFix: (fix: GeoFix) => void
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  position: null,
  gpsStatus: 'idle',
  speed: 0,
  driving: false,
  simulation: false,
  setStatus: (gpsStatus) => set({ gpsStatus }),
  setSimulation: (simulation) => set({ simulation, driving: false, speed: 0 }),
  pushFix: (fix) => {
    const { position, driving, speed } = get()
    const kmh = position ? speedKmh(position, fix) : null
    // Lecturas demasiado seguidas no son fiables: se conserva la anterior
    if (position && kmh === null) return
    set({
      position: fix,
      gpsStatus: 'active',
      speed: kmh ?? speed,
      driving: nextDrivingState(driving, kmh),
    })
  },
}))
