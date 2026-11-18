import { ITEMS, PRECURSORS, type ItemId } from '../data/items'
import { NIGHT_END_HOUR, NIGHT_FACTOR, NIGHT_START_HOUR, WAREHOUSE_FACTOR } from '../data/balance'
import type { PoiKind } from '../types/poi'

/** Existencias por producto (el almacén del HQ) */
export type Inventory = Partial<Record<ItemId, number>>

export const isNight = (d: Date): boolean => d.getHours() >= NIGHT_START_HOUR || d.getHours() < NIGHT_END_HOUR

/** Unidades totales en unas existencias */
export const carried = (inv: Inventory): number => Object.values(inv).reduce((a, b) => a + (b ?? 0), 0)

/** Qué se le puede pedir a cada tipo de lugar (el jugador ya no vende a mano: lo hacen sus camellos). */
export function offersFor(kind: PoiKind): { buy: ItemId[] } {
  switch (kind) {
    case 'warehouse':
    case 'pharmacy':
      // Sin almacenes cerca el juego no puede quedarse bloqueado: la farmacia vende todo, pero a precio normal
      return { buy: PRECURSORS }
    default:
      return { buy: [] }
  }
}

/** Precio unitario en Dinero Sucio. */
export function unitPrice(kind: PoiKind, item: ItemId, now: Date): number {
  const base = ITEMS[item].basePrice
  if (kind === 'warehouse') return Math.max(1, Math.round(base * WAREHOUSE_FACTOR))
  if (kind === 'nightlife') return Math.round(base * (isNight(now) ? NIGHT_FACTOR : 1))
  return base
}
