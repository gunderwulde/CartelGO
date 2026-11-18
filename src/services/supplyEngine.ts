import {
  CARRIER_LEVELS,
  REMOTE_UPGRADE_FACTOR,
  SUPPLIER_LEVELS,
  SUPPLIER_UPGRADE_COSTS,
  SUPPLY_MAX_LEVEL,
} from '../data/supply'
import type { ItemId } from '../data/items'
import type { PoiKind } from '../types/poi'
import { carried, offersFor, unitPrice, type Inventory } from './tradeEngine'

/**
 * Lógica pura de la cadena de suministro (sin stores ni red) para poder probarla.
 * Todo se calcula contra marcas de tiempo (`Date.now()`), nunca con timers (AGENTS §5).
 */

export interface SupplierPoi {
  id: string
  kind: PoiKind
  name: string | null
  lat: number
  lng: number
}

/** Pedido que el punto está preparando o que ya espera a un transportista. */
export interface Order {
  item: ItemId
  /** Unidades que aún no ha recogido ningún transportista */
  qty: number
  /** Instante en que la mercancía está preparada */
  readyAt: number
}

export interface Supplier {
  poi: SupplierPoi
  level: number
  order: Order | null
}

export interface Trip {
  supplierId: string
  item: ItemId
  qty: number
  /** Instante en que llega al almacén del HQ */
  arriveAt: number
}

export interface Carrier {
  id: string
  level: number
  trip: Trip | null
  /** Desde cuándo está libre (contratación o fin del último viaje) */
  freeAt: number
}

export type Suppliers = Record<string, Supplier>

export const newCarrier = (id: string, now: number): Carrier => ({ id, level: 1, trip: null, freeAt: now })

export const supplierInfo = (level: number) => SUPPLIER_LEVELS[Math.min(level, SUPPLY_MAX_LEVEL) - 1]
export const carrierInfo = (level: number) => CARRIER_LEVELS[Math.min(level, SUPPLY_MAX_LEVEL) - 1]

/** Unidades pedidas que aún no están en el almacén (preparándose, esperando o en viaje): ocupan sitio por adelantado. */
export function pending(suppliers: Suppliers, carriers: Carrier[]): number {
  const orders = Object.values(suppliers).reduce((a, s) => a + (s.order?.qty ?? 0), 0)
  const trips = carriers.reduce((a, c) => a + (c.trip?.qty ?? 0), 0)
  return orders + trips
}

export type OrderPlan = { ok: true; qty: number; cost: number; order: Order } | { ok: false; reason: string }

/** Qué se puede pedir ahora: cantidad (limitada por nivel, espacio y dinero) y coste. */
export function planOrder(
  supplier: Supplier,
  item: ItemId,
  requested: number,
  freeSpace: number,
  dirtyCash: number,
  now: number,
): OrderPlan {
  if (!offersFor(supplier.poi.kind).buy.includes(item)) return { ok: false, reason: 'Ese proveedor no vende eso.' }
  if (supplier.order) return { ok: false, reason: 'Ya tienes un pedido en marcha con este proveedor.' }
  const unit = unitPrice(supplier.poi.kind, item, new Date(now))
  const info = supplierInfo(supplier.level)
  const qty = Math.min(requested, info.maxQty, freeSpace, Math.floor(dirtyCash / unit))
  if (qty < 1) {
    if (freeSpace < 1) return { ok: false, reason: 'No hay espacio en el almacén del HQ.' }
    return { ok: false, reason: 'No te llega el dinero sucio.' }
  }
  return { ok: true, qty, cost: qty * unit, order: { item, qty, readyAt: now + info.prepMs } }
}

/** Coste (Dinero Limpio) de subir al siguiente nivel de un punto; null si ya está al máximo. */
export function supplierUpgradeCost(level: number, remote: boolean): number | null {
  if (level >= SUPPLY_MAX_LEVEL) return null
  return SUPPLIER_UPGRADE_COSTS[level] * (remote ? REMOTE_UPGRADE_FACTOR : 1)
}

export interface SupplyState {
  suppliers: Suppliers
  carriers: Carrier[]
  storage: Inventory
  storageCap: number
}

/**
 * Pone la cadena al día hasta `now`: los transportistas libres recogen los pedidos preparados y los llevan al HQ.
 * Se simula por eventos en orden cronológico para que un hueco largo sin abrir la app dé el mismo resultado
 * que haber estado jugando. Devuelve también las unidades entregadas.
 */
export function advanceSupply(state: SupplyState, now: number): SupplyState & { delivered: number } {
  const suppliers: Suppliers = { ...state.suppliers }
  const carriers: Carrier[] = state.carriers.map((c) => ({ ...c }))
  let storage = state.storage
  let delivered = 0

  // Un viaje bloqueado por almacén lleno se reintenta en la siguiente puesta al día
  for (let guard = 0; guard < 10_000; guard++) {
    // Próximo evento: llegada de un viaje, o recogida (transportista libre + pedido preparado)
    type Ev = { time: number; kind: 'arrive' | 'pickup'; carrier: Carrier; supplierId?: string }
    let next: Ev | null = null
    // A igual hora, primero las llegadas (liberan al transportista y espacio)
    const better = (time: number, kind: Ev['kind']): boolean =>
      !next || time < next.time || (time === next.time && kind === 'arrive' && next.kind === 'pickup')
    for (const c of carriers) {
      if (c.trip) {
        if (c.trip.arriveAt <= now && better(c.trip.arriveAt, 'arrive'))
          next = { time: c.trip.arriveAt, kind: 'arrive', carrier: c }
        continue
      }
      for (const [id, s] of Object.entries(suppliers)) {
        if (!s.order || s.order.qty < 1) continue
        const time = Math.max(c.freeAt, s.order.readyAt)
        if (time <= now && better(time, 'pickup')) next = { time, kind: 'pickup', carrier: c, supplierId: id }
      }
    }
    if (!next) break

    const c = next.carrier
    if (next.kind === 'arrive' && c.trip) {
      const space = Math.max(0, state.storageCap - carried(storage))
      const n = Math.min(c.trip.qty, space)
      if (n > 0) {
        storage = { ...storage, [c.trip.item]: (storage[c.trip.item] ?? 0) + n }
        delivered += n
      }
      if (n < c.trip.qty) {
        // No cabe todo: espera en el HQ y lo reintenta más tarde
        c.trip = { ...c.trip, qty: c.trip.qty - n, arriveAt: now + 1 }
        continue
      }
      c.freeAt = c.trip.arriveAt
      c.trip = null
    } else if (next.supplierId) {
      const s = suppliers[next.supplierId]
      const order = s.order
      if (!order) break
      const take = Math.min(order.qty, carrierInfo(c.level).capacity)
      c.trip = { supplierId: next.supplierId, item: order.item, qty: take, arriveAt: next.time + carrierInfo(c.level).tripMs }
      suppliers[next.supplierId] = { ...s, order: order.qty - take > 0 ? { ...order, qty: order.qty - take } : null }
    }
  }
  return { suppliers, carriers, storage, storageCap: state.storageCap, delivered }
}
