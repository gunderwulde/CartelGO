/**
 * Cadena de suministro (GDD §4 bis). Cifras provisionales hasta probarlas en la calle.
 * El primer contacto con un punto es en persona; después se piden envíos y un transportista los lleva al HQ.
 */

export const SUPPLY_MAX_LEVEL = 3

export interface SupplierLevel {
  /** Tiempo que tarda el punto en preparar un pedido (ms) */
  prepMs: number
  /** Unidades máximas por pedido */
  maxQty: number
}

/** Índice = nivel - 1. El nivel 1 es el contacto inicial. */
export const SUPPLIER_LEVELS: SupplierLevel[] = [
  { prepMs: 6 * 60_000, maxQty: 20 },
  { prepMs: 3 * 60_000, maxQty: 50 },
  { prepMs: 1 * 60_000, maxQty: 120 },
]

/** Dinero Limpio para llegar al nivel N (índice N-1) negociando en persona. */
export const SUPPLIER_UPGRADE_COSTS = [0, 600, 2000]
/** Negociar por teléfono multiplica el precio de la mejora */
export const REMOTE_UPGRADE_FACTOR = 3

export interface CarrierLevel {
  /** Duración del viaje de recogida y entrega (ms) */
  tripMs: number
  /** Unidades por viaje */
  capacity: number
}

export const CARRIER_LEVELS: CarrierLevel[] = [
  { tripMs: 10 * 60_000, capacity: 20 },
  { tripMs: 5 * 60_000, capacity: 50 },
  { tripMs: 2 * 60_000, capacity: 120 },
]
export const CARRIER_HIRE_COST = 200
export const CARRIER_UPGRADE_COSTS = [0, 600, 2000]
/** Transportistas máximos por nivel de HQ */
export const CARRIER_SLOTS = [1, 2, 3]
