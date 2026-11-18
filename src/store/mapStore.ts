import { create } from 'zustand'
import type { Poi } from '../types/poi'

export type PoiLoadStatus = 'idle' | 'loading' | 'ready' | 'error'

interface MapState {
  pois: Record<string, Poi>
  status: PoiLoadStatus
  addPois: (pois: Poi[]) => void
  setStatus: (s: PoiLoadStatus) => void
  clearPois: () => void
}

export const useMapStore = create<MapState>((set) => ({
  pois: {},
  status: 'idle',
  addPois: (pois) =>
    set((s) => {
      const next = { ...s.pois }
      for (const p of pois) next[p.id] = p
      return { pois: next }
    }),
  setStatus: (status) => set({ status }),
  clearPois: () => set({ pois: {}, status: 'idle' }),
}))
