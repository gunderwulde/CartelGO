/**
 * Favores: tercera moneda para saltarse esperas (GDD §4 sexies).
 * No se compra con Dinero Sucio ni Limpio, así que no altera la economía.
 */

/** Favores de regalo al empezar */
export const FAVORS_START = 5
/** Cada favor salta esta cantidad de espera (se redondea hacia arriba) */
export const FAVOR_MS = 5 * 60_000
/** Despistar a la policía (Heat a 0) */
export const CALM_HEAT_COST = 3

/** Favores que cuesta saltar `remainingMs` de espera (mínimo 1) */
export const favorCost = (remainingMs: number): number => Math.max(1, Math.ceil(remainingMs / FAVOR_MS))
