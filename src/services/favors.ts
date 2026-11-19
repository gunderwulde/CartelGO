/**
 * Favores: tercera moneda para saltarse esperas (GDD §4 sexies).
 * No se compra con Dinero Sucio ni Limpio, así que no altera la economía. Los números viven en balance.json.
 */
import { CFG, min } from "../data/config";

/** Favores de regalo al empezar */
export const FAVORS_START = CFG.favores.iniciales;
/** Cada favor salta esta cantidad de espera (se redondea hacia arriba) */
export const FAVOR_MS = min(CFG.favores.minutosPorFavor);
/** Despistar a la policía (Heat a 0) */
export const CALM_HEAT_COST = CFG.favores.costeCalmarPolicia;
/** Soborno a la policía: Dinero Sucio que cuesta poner el Heat a 0 sin gastar favores */
export const BRIBE_COST = CFG.calor.sobornoSucio;

/** Favores que cuesta saltar `remainingMs` de espera (mínimo 1) */
export const favorCost = (remainingMs: number): number =>
  Math.max(1, Math.ceil(remainingMs / FAVOR_MS));
