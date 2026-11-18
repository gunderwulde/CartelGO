import { create } from 'zustand'

export interface ConfirmDialog {
  message: string
  yes: string
  no: string
  onYes: () => void
}

interface ConfirmState {
  dialog: ConfirmDialog | null
  /** Abre el aviso del juego (nada de popups del sistema) */
  ask: (message: string, onYes: () => void, opts?: { yes?: string; no?: string }) => void
  close: () => void
}

export const useConfirmStore = create<ConfirmState>((set) => ({
  dialog: null,
  ask: (message, onYes, opts) => set({ dialog: { message, onYes, yes: opts?.yes ?? 'Sí, adelante', no: opts?.no ?? 'Mejor no' } }),
  close: () => set({ dialog: null }),
}))
