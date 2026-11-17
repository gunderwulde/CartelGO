/** Valores de balance del bucle de calle. Provisionales hasta el Sprint 5. */

export const START_CAPACITY = 30
export const START_DIRTY_CASH = 100
/** Mercancía inicial para poder probar la venta hasta que exista el laboratorio (Sprint 4). */
export const START_INVENTORY = { hierba: 10 } as const

/** El almacén clandestino vende los precursores a este factor del precio base. */
export const WAREHOUSE_FACTOR = 0.6
/** Unidades que una farmacia vende por día. */
export const PHARMACY_DAILY_LIMIT = 8
/** Bares y discotecas pagan x2 entre estas horas locales (GDD §3). */
export const NIGHT_START_HOUR = 20
export const NIGHT_END_HOUR = 4
export const NIGHT_FACTOR = 2

/** Heat (medidor de Búsqueda, 0-100) */
export const HEAT_MAX = 100
/** Sube por segundo dentro de la zona de una comisaría */
export const HEAT_RISE_PER_S = 2
/** Baja por segundo fuera de ella */
export const HEAT_DECAY_PER_S = 0.5
/** Heat tras una redada */
export const HEAT_AFTER_RAID = 30
