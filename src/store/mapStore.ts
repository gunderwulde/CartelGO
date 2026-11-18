import { create } from 'zustand'
import type { Poi } from '../types/poi'

export type PoiLoadStatus = 'idle' | 'loading' | 'ready' | 'error'

interface MapState {
  pois: Record<string, Poi>
  status: PoiLoadStatus
  /** Petición de centrar el mapa en un punto (el tutorial, p. ej.). `n` cambia en cada petición */
  focus: { lat: number; lng: number; n: number } | null
  focusOn: (lat: number, lng: number) => void
  addPois: (pois: Poi[]) => void
  setStatus: (s: PoiLoadStatus) => void
  clearPois: () => void
}

export const useMapStore = create<MapState>((set) => ({
  pois: {},
  status: 'idle',
  focus: null,
  focusOn: (lat, lng) => set((s) => ({ focus: { lat, lng, n: (s.focus?.n ?? 0) + 1 } })),
  addPois: (pois) =>
    set((s) => {
      const next = { ...s.pois }
      for (const p of pois) next[p.id] = p
      return { pois: next }
    }),
  setStatus: (status) => set({ status }),
  clearPois: () => set({ pois: {}, status: 'idle' }),
}))
