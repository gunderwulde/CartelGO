import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { del, get, set } from 'idb-keyval'
import type { ItemId } from '../data/items'
import { START_CLEAN_CASH } from '../data/buildings'
import { HEAT_AFTER_RAID, START_CAPACITY, START_DIRTY_CASH, START_INVENTORY } from '../data/balance'
import { buy, sell, dayKey, type DailyLimits, type Inventory, type TradePoi, type TradeResult } from '../services/tradeEngine'

/** Persistencia offline-first en IndexedDB (AGENTS §2). Cada cambio se guarda al instante. */
const idbStorage: StateStorage = {
  getItem: async (name) => (await get<string>(name)) ?? null,
  setItem: async (name, value) => set(name, value),
  removeItem: async (name) => del(name),
}

interface InventoryState {
  inventory: Inventory
  dirtyCash: number
  cleanCash: number
  capacity: number
  limits: DailyLimits
  /** Heat / Búsqueda, 0-100 */
  heat: number
  /** Mensaje efímero para el HUD (no se guarda) */
  notice: string | null

  /** `sellMult`: bonus de pureza del laboratorio aplicado a las ventas */
  trade: (mode: 'buy' | 'sell', poi: TradePoi, item: ItemId, qty: number, sellMult?: number) => TradeResult
  setHeat: (heat: number) => void
  /** Redada: se pierde la mercancía que llevas encima (GDD §3). */
  raid: () => void
  setNotice: (n: string | null) => void
}

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set, getState) => ({
      inventory: { ...START_INVENTORY },
      dirtyCash: START_DIRTY_CASH,
      cleanCash: START_CLEAN_CASH,
      capacity: START_CAPACITY,
      limits: { day: dayKey(new Date()), bought: {} },
      heat: 0,
      notice: null,

      trade: (mode, poi, item, qty, sellMult = 1) => {
        const { inventory, dirtyCash, capacity, limits } = getState()
        const state = { inventory, dirtyCash, capacity, limits, sellMult }
        const now = new Date()
        const result = mode === 'buy' ? buy(state, poi, item, qty, now) : sell(state, poi, item, qty, now)
        if (result.ok) {
          const { inventory: inv, dirtyCash: cash, limits: lim } = result.state
          set({ inventory: inv, dirtyCash: cash, limits: lim })
        }
        return result
      },
      setHeat: (heat) => set({ heat }),
      raid: () =>
        set({ inventory: {}, heat: HEAT_AFTER_RAID, notice: '¡Redada! La policía se ha quedado con tu mercancía.' }),
      setNotice: (notice) => set({ notice }),
    }),
    {
      name: 'cartelgo:save',
      version: 1,
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({
        inventory: s.inventory,
        dirtyCash: s.dirtyCash,
        cleanCash: s.cleanCash,
        capacity: s.capacity,
        limits: s.limits,
        heat: s.heat,
      }),
    },
  ),
)
