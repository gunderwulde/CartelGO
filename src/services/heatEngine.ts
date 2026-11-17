import { HEAT_DECAY_PER_S, HEAT_MAX, HEAT_RISE_PER_S } from '../data/balance'

/** Heat tras `dtSec` segundos, dentro o fuera de la zona de una comisaría. */
export function nextHeat(heat: number, inPoliceZone: boolean, dtSec: number): number {
  const delta = (inPoliceZone ? HEAT_RISE_PER_S : -HEAT_DECAY_PER_S) * dtSec
  return Math.min(HEAT_MAX, Math.max(0, heat + delta))
}

export const isBusted = (heat: number): boolean => heat >= HEAT_MAX
