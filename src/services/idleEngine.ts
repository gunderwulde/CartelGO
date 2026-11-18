import {
  DEALER_CUT,
  DEALER_CUT_BASE,
  DEALER_CUT_HEAT,
  DEALER_CUT_PAYOUT,
  DEALER_CUT_REP_LOSS,
  DEALER_REP_SHARE,
  DEALER_THEFT_BASE,
  DEALER_THEFT_SHARE,
  DEALER_INTERVAL_MS,
  LAUNDER_DIRTY_PER_TICK,
  LAUNDER_TICK_MS,
  LAUNDER_YIELD,
  OFFLINE_CAP_MS,
  RECIPES,
  REP_PER_UNIT,
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
  /** Fiabilidad 0-100 (ausente en camellos anteriores: se deduce del id) */
  honesty?: number
  /** Libro de cuentas */
  sold?: number
  earned?: number
  /** Dinero que te ha quitado (robos y adulteraciones) */
  stolen?: number
  cutUnits?: number
}

export interface DealerEvent {
  at: number
  dealerId: string
  poiName: string | null
  kind: 'theft' | 'cut'
  /** Dinero Sucio que te ha costado */
  amount: number
}

/** Número pseudoaleatorio estable en [0, 1) a partir de un texto: el mismo camello y el mismo instante dan siempre lo mismo
 *  (el cálculo offline cuadra con el online y se podrá reproducir en el servidor). */
export function hashUnit(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  h ^= h >>> 15
  h = Math.imul(h, 2246822507)
  h ^= h >>> 13
  h = Math.imul(h, 3266489909)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** Fiabilidad inicial de un camello nuevo: entre 30 y 90 */
export const rollHonesty = (id: string): number => Math.round(30 + hashUnit(`h:${id}`) * 60)
export const honestyOf = (d: Dealer): number => d.honesty ?? rollHonesty(d.id)

/** Lo que devuelve syncIdle además del estado: sucesos de camellos y su efecto en reputación y Heat */
export interface IdleResult extends IdleState {
  events: DealerEvent[]
  repDelta: number
  heatDelta: number
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

function runDealers(s: IdleState, now: number): IdleResult {
  const none = { events: [], repDelta: 0, heatDelta: 0 }
  if (s.dealers.length === 0) return { ...s, dealersAt: now, ...none }
  const from = Math.max(s.dealersAt, now - OFFLINE_CAP_MS)
  const ticks = Math.floor((now - from) / DEALER_INTERVAL_MS)
  if (ticks < 1) return { ...s, dealersAt: from, ...none }

  const storage: Inventory = { ...s.storage }
  const dealers = s.dealers.map((d) => ({ ...d }))
  const events: DealerEvent[] = []
  const date = new Date(now)
  const slot0 = Math.floor(from / DEALER_INTERVAL_MS)
  let cash = s.dirtyCash
  let repDelta = 0
  let heatDelta = 0
  outer: for (let t = 0; t < ticks; t++) {
    for (const d of dealers) {
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

      const normal = Math.round(bestPrice * DEALER_CUT)
      const distrust = 1 - honestyOf(d) / 100
      const at = from + (t + 1) * DEALER_INTERVAL_MS
      let got = normal
      if (hashUnit(`${d.id}:${slot0 + t}:cut`) < DEALER_CUT_BASE * distrust) {
        got = Math.round(normal * DEALER_CUT_PAYOUT)
        events.push({ at, dealerId: d.id, poiName: d.name, kind: 'cut', amount: normal - got })
        d.cutUnits = (d.cutUnits ?? 0) + 1
        d.stolen = (d.stolen ?? 0) + (normal - got)
        heatDelta += DEALER_CUT_HEAT
        repDelta -= DEALER_CUT_REP_LOSS
      }
      if (hashUnit(`${d.id}:${slot0 + t}:theft`) < DEALER_THEFT_BASE * distrust) {
        const lost = Math.round(got * DEALER_THEFT_SHARE)
        got -= lost
        events.push({ at, dealerId: d.id, poiName: d.name, kind: 'theft', amount: lost })
        d.stolen = (d.stolen ?? 0) + lost
      }
      cash += got
      d.sold = (d.sold ?? 0) + 1
      d.earned = (d.earned ?? 0) + got
      repDelta += REP_PER_UNIT[best] * DEALER_REP_SHARE
    }
  }
  // Sin existencias el reloj sigue corriendo: no se acumula tiempo "a deber"
  return {
    ...s,
    storage,
    dealers,
    dirtyCash: cash,
    dealersAt: from + ticks * DEALER_INTERVAL_MS,
    events: events.slice(-100),
    repDelta,
    heatDelta,
  }
}

function runLaundering<T extends IdleState>(s: T, now: number): T {
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
export function syncIdle(state: IdleState, now: number): IdleResult {
  return runLaundering(runDealers(runLab(state, now), now), now)
}
