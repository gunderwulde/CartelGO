import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { del, get, set } from 'idb-keyval'
import { play } from '../services/sound'
import { START_CLEAN_CASH } from '../data/buildings'
import { HEAT_AFTER_RAID, START_DIRTY_CASH } from '../data/balance'

/** Persistencia offline-first en IndexedDB (AGENTS §2). Cada cambio se guarda al instante. */
const idbStorage: StateStorage = {
  getItem: async (name) => (await get<string>(name)) ?? null,
  setItem: async (name, value) => set(name, value),
  removeItem: async (name) => del(name),
}

interface InventoryState {
  dirtyCash: number
  cleanCash: number
  /** Heat / Búsqueda, 0-100 */
  heat: number
  /** Mensaje efímero para el HUD (no se guarda) */
  notice: string | null

  setHeat: (heat: number) => void
  /** Redada: el Heat baja a su nivel de tras-redada. Lo confiscado del almacén lo decide quien la dispara. */
  raid: (message?: string) => void
  setNotice: (n: string | null) => void
}

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set) => ({
      dirtyCash: START_DIRTY_CASH,
      cleanCash: START_CLEAN_CASH,
      heat: 0,
      notice: null,

      setHeat: (heat) => set({ heat }),
      raid: (message = '¡Redada! La policía se ha llevado parte de tu mercancía.') => {
        play('raid')
        set({ heat: HEAT_AFTER_RAID, notice: message })
      },
      setNotice: (notice) => set({ notice }),
    }),
    {
      name: 'cartelgo:save',
      version: 1,
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({
        dirtyCash: s.dirtyCash,
        cleanCash: s.cleanCash,
        heat: s.heat,
      }),
    },
  ),
)
