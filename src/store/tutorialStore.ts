import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Número de pasos del tutorial (los define Tutorial.tsx) */
export const TUTORIAL_STEPS = 6

interface TutorialState {
  /** Paso actual (solo avanza); al llegar al final se da por terminado */
  step: number
  /** Saltado o terminado: no se muestra más */
  done: boolean
  /** La tarjeta se está mostrando (se oculta sola a los 5 s). No se guarda */
  open: boolean
  setStep: (step: number) => void
  finish: () => void
  /** Volver a empezar */
  restart: () => void
  show: () => void
  hide: () => void
}

export const useTutorialStore = create<TutorialState>()(
  persist(
    (set) => ({
      step: 0,
      done: false,
      open: false,
      setStep: (step) => set({ step }),
      finish: () => set({ done: true, open: false }),
      restart: () => set({ step: 0, done: false, open: false }),
      show: () => set({ open: true }),
      hide: () => set({ open: false }),
    }),
    { name: 'cartelgo:tutorial', partialize: (s) => ({ step: s.step, done: s.done }) },
  ),
)

/** ¿Hay algo del tutorial pendiente? (para que parpadee el botón) */
export const tutorialPending = (s: Pick<TutorialState, 'step' | 'done'>): boolean => !s.done && s.step < TUTORIAL_STEPS
