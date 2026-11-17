import {
  DEALER_CUT,
  DEALER_INTERVAL_MS,
  LAUNDER_DIRTY_PER_TICK,
  LAUNDER_TICK_MS,
  LAUNDER_YIELD,
  OFFLINE_CAP_MS,
  RECIPES,
  labSpeed,
  type RecipeId,
} from '../data/buildings'
import { PRODUCTS, type ItemId } from '../data/items'
import { carried, unitPrice, type Inventory } from './tradeEngine'

export interface Job {
  recipe: RecipeId
  /** Lotes que faltan por producir */
  remaining: number
  /** Instante (epoch ms) en que termina el siguiente lote */
  nextAt: number
}

export interface Dealer {
  id: string
  poiId: string
  kind: 'park' | 'nightlife'
  name: string | null
}

export interface Business {
  poiId: string
  name: string | null
}

export interface IdleState {
  storage: Inventory
  storageCap: number
  labLevel: number
  job: Job | null
  dealers: Dealer[]
  businesses: Business[]
  dirtyCash: number
  cleanCash: number
  /** Cursores: el progreso se calcula siempre contra Date.now(), no con timers (AGENTS §5) */
  dealersAt: number
  launderAt: number
}

export const batchDurationMs = (recipe: RecipeId, labLevel: number): number =>
  (RECIPES[recipe].baseSeconds * 1000) / labSpeed(labLevel)

function runLab(s: IdleState, now: number): IdleState {
  if (!s.job) return s
  const { recipe } = s.job
  const out = RECIPES[recipe].output
  const dur = batchDurationMs(recipe, s.labLevel)
  const storage: Inventory = { ...s.storage }
  let { remaining, nextAt } = s.job

  while (remaining > 0 && now >= nextAt) {
    if (carried(storage) >= s.storageCap) {
      // Almacén lleno: el lote terminado espera hasta que haya sitio
      nextAt = now
      break
    }
    storage[out] = (storage[out] ?? 0) + 1
    remaining--
    nextAt += dur
  }
  return { ...s, storage, job: remaining > 0 ? { recipe, remaining, nextAt } : null }
}

function runDealers(s: IdleState, now: number): IdleState {
  if (s.dealers.length === 0) return { ...s, dealersAt: now }
  const from = Math.max(s.dealersAt, now - OFFLINE_CAP_MS)
  const ticks = Math.floor((now - from) / DEALER_INTERVAL_MS)
  if (ticks < 1) return { ...s, dealersAt: from }

  const storage: Inventory = { ...s.storage }
  const date = new Date(now)
  let cash = s.dirtyCash
  outer: for (let t = 0; t < ticks; t++) {
    for (const d of s.dealers) {
      let best: ItemId | null = null
      let bestPrice = 0
      for (const item of PRODUCTS) {
        if ((storage[item] ?? 0) < 1) continue
        const p = unitPrice(d.kind, item, date)
        if (p > bestPrice) {
          best = item
          bestPrice = p
        }
      }
      if (!best) break outer
      storage[best] = (storage[best] ?? 0) - 1
      cash += Math.round(bestPrice * DEALER_CUT)
    }
  }
  // Sin existencias el reloj sigue corriendo: no se acumula tiempo "a deber"
  return { ...s, storage, dirtyCash: cash, dealersAt: from + ticks * DEALER_INTERVAL_MS }
}

function runLaundering(s: IdleState, now: number): IdleState {
  if (s.businesses.length === 0) return { ...s, launderAt: now }
  const from = Math.max(s.launderAt, now - OFFLINE_CAP_MS)
  const ticks = Math.floor((now - from) / LAUNDER_TICK_MS)
  if (ticks < 1) return { ...s, launderAt: from }
  const amount = Math.min(s.dirtyCash, ticks * LAUNDER_DIRTY_PER_TICK * s.businesses.length)
  return {
    ...s,
    dirtyCash: s.dirtyCash - amount,
    cleanCash: s.cleanCash + Math.floor(amount * LAUNDER_YIELD),
    launderAt: from + ticks * LAUNDER_TICK_MS,
  }
}

/** Avanza laboratorio, camellos y blanqueo hasta `now`. Pura: sirve igual online que tras horas offline. */
export function syncIdle(state: IdleState, now: number): IdleState {
  return runLaundering(runDealers(runLab(state, now), now), now)
}
