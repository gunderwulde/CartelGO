/**
 * Anuncio de rescate (GDD §4 quinquies): si te quedas sin dinero, el juego propone ver un anuncio
 * (de momento un hueco de prueba, sin red publicitaria) a cambio de Dinero Sucio.
 */

/** Se ofrece cuando el Dinero Sucio baja de aquí... */
export const AD_RESCUE_DIRTY_BELOW = 30
/** ...y además no tienes limpio para ensuciar (el cambio de limpio a sucio da la mitad) */
export const AD_RESCUE_CLEAN_BELOW = 100
/** Recompensa en Dinero Sucio */
export const AD_RESCUE_REWARD = 100
/** Lo que dura el anuncio (no se puede cerrar) */
export const AD_DURATION_MS = 20_000
/** Espera mínima entre dos rescates, para que no sea una máquina de dinero */
export const AD_COOLDOWN_MS = 5 * 60_000

export function canOfferAd(dirtyCash: number, cleanCash: number, lastAdAt: number, now: number): boolean {
  return dirtyCash < AD_RESCUE_DIRTY_BELOW && cleanCash < AD_RESCUE_CLEAN_BELOW && now - lastAdAt >= AD_COOLDOWN_MS
}
