/** Valores de balance del bucle de calle. Los números viven en balance.json. */
import { CFG } from "./config";

export const START_DIRTY_CASH = CFG.inicio.dineroSucio;

/** El almacén clandestino vende los precursores a este factor del precio base. */
export const WAREHOUSE_FACTOR = CFG.mercado.factorAlmacen;
/** Bares y discotecas pagan más entre estas horas locales (GDD §3). */
export const NIGHT_START_HOUR = CFG.mercado.nocheDesdeHora;
export const NIGHT_END_HOUR = CFG.mercado.nocheHastaHora;
export const NIGHT_FACTOR = CFG.mercado.factorNoche;

/** Heat (medidor de Búsqueda, 0-100) */
export const HEAT_MAX = CFG.calor.maximo;
/** Sube por segundo dentro de la zona de una comisaría */
export const HEAT_RISE_PER_S = CFG.calor.subidaPorSegundoEnZonaPolicia;
/** Baja por segundo fuera de ella */
export const HEAT_DECAY_PER_S = CFG.calor.bajadaPorSegundo;
/** Heat tras una redada */
export const HEAT_AFTER_RAID = CFG.calor.trasRedada;
/** Parte del almacén que se lleva la policía en una redada */
export const RAID_SEIZE_SHARE = CFG.calor.parteDelAlmacenConfiscada;
