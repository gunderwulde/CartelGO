import { create } from 'zustand'

export interface AwayReport {
  /** Ms que has estado fuera */
  awayMs: number
  dirty: number
  clean: number
  batches: number
  deliveries: number
  sales: number
  /** Dinero que te han quitado los camellos */
  stolen: number
  incidents: number
}

interface AwayState {
  report: AwayReport | null
  show: (r: AwayReport) => void
  close: () => void
}

export const useAwayStore = create<AwayState>((set) => ({
  report: null,
  show: (report) => set({ report }),
  close: () => set({ report: null }),
}))

/** ¿Hay algo que contar? */
export const hasNews = (r: AwayReport): boolean =>
  r.dirty > 0 || r.clean > 0 || r.batches > 0 || r.deliveries > 0 || r.sales > 0 || r.incidents > 0
