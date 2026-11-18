import type { ItemId } from '../data/items'

export interface LastOrder {
  poiId: string
  item: ItemId
  qty: number
}

const KEY = 'cartelgo:lastOrder'

/** Último pedido hecho, para repetirlo con un toque. Solo una comodidad: si falta, no pasa nada. */
export function saveLastOrder(o: LastOrder): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(o))
  } catch {
    /* sin almacenamiento */
  }
}

export function loadLastOrder(): LastOrder | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const o = JSON.parse(raw) as Partial<LastOrder>
    return typeof o.poiId === 'string' && typeof o.item === 'string' && typeof o.qty === 'number' ? (o as LastOrder) : null
  } catch {
    return null
  }
}
