import { create } from 'zustand'

interface CelebrateState {
  /** Cambia en cada celebración para reiniciar la animación */
  n: number
  text: string | null
  celebrate: (text: string) => void
  clear: () => void
}

/** Momento de éxito (pedido entregado, lote listo, paso del tutorial…): se muestra un instante con destellos */
export const useCelebrateStore = create<CelebrateState>((set) => ({
  n: 0,
  text: null,
  celebrate: (text) => set((s) => ({ n: s.n + 1, text })),
  clear: () => set({ text: null }),
}))
