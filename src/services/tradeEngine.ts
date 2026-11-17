import { ITEMS, PRECURSORS, PRODUCTS, type ItemId } from '../data/items'
import {
  NIGHT_END_HOUR,
  NIGHT_FACTOR,
  NIGHT_START_HOUR,
  PHARMACY_DAILY_LIMIT,
  WAREHOUSE_FACTOR,
} from '../data/balance'
import type { PoiKind } from '../types/poi'

export type Inventory = Partial<Record<ItemId, number>>

export interface DailyLimits {
  /** Día local, "YYYY-MM-DD" */
  day: string
  /** Unidades compradas hoy por POI */
  bought: Record<string, number>
}

export interface TradeState {
  inventory: Inventory
  dirtyCash: number
  capacity: number
  limits: DailyLimits
  /** Multiplicador de pureza sobre el precio de venta (por defecto 1) */
  sellMult?: number
}

export interface TradePoi {
  id: string
  kind: PoiKind
}

export type TradeResult =
  | { ok: true; qty: number; total: number; state: TradeState }
  | { ok: false; reason: string }

export const dayKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const isNight = (d: Date): boolean => d.getHours() >= NIGHT_START_HOUR || d.getHours() < NIGHT_END_HOUR

export const carried = (inv: Inventory): number => Object.values(inv).reduce((a, b) => a + (b ?? 0), 0)

/** Qué se puede comprar y vender en cada tipo de lugar. */
export function offersFor(kind: PoiKind): { buy: ItemId[]; sell: ItemId[] } {
  switch (kind) {
    case 'warehouse':
      return { buy: PRECURSORS, sell: [] }
    case 'pharmacy':
      return { buy: ['quimicos'], sell: [] }
    case 'park':
    case 'nightlife':
      return { buy: [], sell: PRODUCTS }
    default:
      return { buy: [], sell: [] }
  }
}

/** Precio unitario en Dinero Sucio. */
export function unitPrice(kind: PoiKind, item: ItemId, now: Date): number {
  const base = ITEMS[item].basePrice
  if (kind === 'warehouse') return Math.max(1, Math.round(base * WAREHOUSE_FACTOR))
  if (kind === 'nightlife') return Math.round(base * (isNight(now) ? NIGHT_FACTOR : 1))
  return base
}

/** Unidades que aún se pueden comprar hoy en este POI (Infinity si no hay límite). */
export function dailyRemaining(poi: TradePoi, limits: DailyLimits, now: Date): number {
  if (poi.kind !== 'pharmacy') return Infinity
  const bought = limits.day === dayKey(now) ? (limits.bought[poi.id] ?? 0) : 0
  return Math.max(0, PHARMACY_DAILY_LIMIT - bought)
}

export function buy(state: TradeState, poi: TradePoi, item: ItemId, requested: number, now: Date): TradeResult {
  if (!offersFor(poi.kind).buy.includes(item)) return { ok: false, reason: 'Aquí no se vende eso.' }
  const price = unitPrice(poi.kind, item, now)
  const space = state.capacity - carried(state.inventory)
  const affordable = Math.floor(state.dirtyCash / price)
  const remaining = dailyRemaining(poi, state.limits, now)

  const qty = Math.min(requested, space, affordable, remaining)
  if (qty < 1) {
    if (remaining < 1) return { ok: false, reason: 'Hoy ya no te vende más.' }
    if (space < 1) return { ok: false, reason: 'Mochila llena.' }
    return { ok: false, reason: 'No te llega el dinero sucio.' }
  }

  const today = dayKey(now)
  const bought = state.limits.day === today ? state.limits.bought : {}
  return {
    ok: true,
    qty,
    total: qty * price,
    state: {
      ...state,
      dirtyCash: state.dirtyCash - qty * price,
      inventory: { ...state.inventory, [item]: (state.inventory[item] ?? 0) + qty },
      limits: { day: today, bought: { ...bought, [poi.id]: (bought[poi.id] ?? 0) + qty } },
    },
  }
}

export function sell(state: TradeState, poi: TradePoi, item: ItemId, requested: number, now: Date): TradeResult {
  if (!offersFor(poi.kind).sell.includes(item)) return { ok: false, reason: 'Aquí no compran eso.' }
  const qty = Math.min(requested, state.inventory[item] ?? 0)
  if (qty < 1) return { ok: false, reason: 'No llevas nada de eso.' }
  const total = qty * Math.round(unitPrice(poi.kind, item, now) * (state.sellMult ?? 1))
  return {
    ok: true,
    qty,
    total,
    state: {
      ...state,
      dirtyCash: state.dirtyCash + total,
      inventory: { ...state.inventory, [item]: (state.inventory[item] ?? 0) - qty },
    },
  }
}
