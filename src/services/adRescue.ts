/**
 * Anuncio de rescate (GDD §4 quinquies): si te quedas sin dinero, el juego propone ver un anuncio
 * (de momento un hueco de prueba, sin red publicitaria) a cambio de Dinero Sucio. Números en balance.json.
 */
import { CFG, min, sec } from "../data/config";

/** Se ofrece cuando el Dinero Sucio baja de aquí... */
export const AD_RESCUE_DIRTY_BELOW = CFG.anuncio.sucioPorDebajoDe;
/** ...y además no tienes limpio para ensuciar (el cambio de limpio a sucio da la mitad) */
export const AD_RESCUE_CLEAN_BELOW = CFG.anuncio.limpioPorDebajoDe;
/** Recompensa en Dinero Sucio */
export const AD_RESCUE_REWARD = CFG.anuncio.recompensaSucio;
/** Lo que dura el anuncio (no se puede cerrar) */
export const AD_DURATION_MS = sec(CFG.anuncio.duracionSegundos);
/** Espera mínima entre dos rescates, para que no sea una máquina de dinero */
export const AD_COOLDOWN_MS = min(CFG.anuncio.esperaMinutos);

/** Anuncio voluntario a cambio de favores */
export const AD_FAVOR_REWARD = CFG.anuncio.favoresPorAnuncio;
/** Espera mínima entre dos anuncios de favor */
export const AD_FAVOR_COOLDOWN_MS = min(CFG.anuncio.esperaFavorMinutos);

export const canWatchFavorAd = (lastAt: number, now: number): boolean =>
  now - lastAt >= AD_FAVOR_COOLDOWN_MS;

export function canOfferAd(
  dirtyCash: number,
  cleanCash: number,
  lastAdAt: number,
  now: number,
): boolean {
  return (
    dirtyCash < AD_RESCUE_DIRTY_BELOW &&
    cleanCash < AD_RESCUE_CLEAN_BELOW &&
    now - lastAdAt >= AD_COOLDOWN_MS
  );
}
