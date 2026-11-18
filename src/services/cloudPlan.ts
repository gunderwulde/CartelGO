import type { VisitedPoi } from '../store/baseStore'
import type { Business, Dealer, Job } from './idleEngine'
import type { Carrier, Suppliers } from './supplyEngine'
import type { DailyLimits, Inventory } from './tradeEngine'

/**
 * Partida serializable que se sube a la nube. Lógica pura (sin stores ni red) para poder probarla.
 * PRIVACIDAD (AGENTS §3): aquí NO hay coordenadas del HQ; solo se envía su celda H3 res. 7 aparte.
 */
export interface SaveBlob {
  v: 1
  inventory: {
    inventory: Inventory
    dirtyCash: number
    cleanCash: number
    capacity: number
    limits: DailyLimits
    heat: number
  }
  base: {
    hqLevel: number
    labLevel: number
    storageLevel: number
    backpackLevel: number
    storage: Inventory
    job: Job | null
    dealers: Dealer[]
    businesses: Business[]
    visited: Record<string, VisitedPoi>
    /** Cadena de suministro; ausente en partidas guardadas antes del Sprint 7 */
    suppliers?: Suppliers
    carriers?: Carrier[]
    reputation: number
    dealersAt: number
    launderAt: number
  }
}

export interface SaveSummary {
  reputation: number
  cleanCash: number
  dirtyCash: number
  dealers: number
  businesses: number
}

/** Comprobación superficial de lo que llega de la red antes de tocar los stores. */
export function isSaveBlob(x: unknown): x is SaveBlob {
  if (typeof x !== 'object' || x === null) return false
  const b = x as Partial<SaveBlob>
  return (
    b.v === 1 &&
    typeof b.inventory === 'object' &&
    b.inventory !== null &&
    typeof b.inventory.cleanCash === 'number' &&
    typeof b.inventory.dirtyCash === 'number' &&
    typeof b.base === 'object' &&
    b.base !== null &&
    typeof b.base.reputation === 'number' &&
    Array.isArray(b.base.dealers) &&
    Array.isArray(b.base.businesses)
  )
}

/** Cambios hechos por el jugador. Ignora los cursores del motor idle, que se mueven solos con el tiempo. */
export const progressKey = (b: SaveBlob): string =>
  [
    b.base.hqLevel,
    b.base.labLevel,
    b.base.storageLevel,
    b.base.backpackLevel,
    b.base.reputation,
    b.base.dealers.length,
    b.base.businesses.length,
    Object.keys(b.base.visited).length,
    Object.keys(b.base.suppliers ?? {}).length,
    Object.values(b.base.suppliers ?? {}).reduce((a, x) => a + x.level, 0),
    (b.base.carriers ?? []).reduce((a, x) => a + x.level, 0),
  ].join('|')

/** Huella completa: si no cambia, no hay nada que subir. */
export const fullKey = (b: SaveBlob): string => JSON.stringify(b)

export const summarize = (b: SaveBlob): SaveSummary => ({
  reputation: Math.round(b.base.reputation),
  cleanCash: Math.round(b.inventory.cleanCash),
  dirtyCash: Math.round(b.inventory.dirtyCash),
  dealers: b.base.dealers.length,
  businesses: b.base.businesses.length,
})

/** Una partida recién empezada: nada que perder si se sustituye por la de la nube. */
export const isPristine = (b: SaveBlob): boolean =>
  b.base.reputation === 0 &&
  b.base.dealers.length === 0 &&
  b.base.businesses.length === 0 &&
  Object.keys(b.base.visited).length === 0 &&
  Object.keys(b.base.suppliers ?? {}).length === 0 &&
  (b.base.carriers ?? []).length === 0 &&
  b.base.hqLevel === 1 &&
  b.base.labLevel === 1 &&
  b.base.storageLevel === 1 &&
  b.base.backpackLevel === 1

export type SyncPlan = 'push' | 'pull' | 'ask' | 'noop'

export interface PlanInput {
  /** Existe una partida de este usuario en el servidor */
  hasServer: boolean
  serverRevision: number
  /** Revisión de la última sincronización de ESTE dispositivo con ESTE usuario; null si nunca */
  metaRevision: number | null
  /** El jugador ha progresado en local desde esa sincronización */
  dirty: boolean
  /** La partida local está sin estrenar */
  pristine: boolean
}

/** Decide qué hacer al conectar. Nunca pisa progreso de ninguno de los dos lados sin preguntar. */
export function planSync(i: PlanInput): SyncPlan {
  if (!i.hasServer) return 'push'
  if (i.metaRevision === null) return i.pristine ? 'pull' : 'ask'
  if (i.serverRevision === i.metaRevision) return i.dirty ? 'push' : 'noop'
  if (i.serverRevision > i.metaRevision) return i.dirty ? 'ask' : 'pull'
  return 'push' // el servidor "va por detrás" (se borró): lo local manda
}
