import type { ItemId } from './items'

/** Nivel máximo de cada edificio. El HQ limita al resto (GDD §5). */
export const MAX_LEVEL = 3

/** Coste en Dinero Limpio para llegar al nivel N (índice N-1). */
export const HQ_COSTS = [0, 300, 1200]
export const LAB_COSTS = [0, 400, 1500]
export const STORAGE_COSTS = [0, 250, 900]
export const BACKPACK_COSTS = [0, 200, 800]

export const STORAGE_CAPACITY = [100, 250, 600]
export const BACKPACK_CAPACITY = [30, 60, 120]
/** Camellos máximos por nivel de HQ */
export const DEALER_SLOTS = [2, 4, 6]

export const LAB_NAMES = ['Cocina de garaje', 'Laboratorio Básico', 'Laboratorio Avanzado']

export type UpgradeKind = 'hq' | 'lab' | 'storage' | 'backpack'

export const UPGRADE_INFO: Record<UpgradeKind, { label: string; costs: number[] }> = {
  hq: { label: 'Cuartel General', costs: HQ_COSTS },
  lab: { label: 'Laboratorio', costs: LAB_COSTS },
  storage: { label: 'Almacén', costs: STORAGE_COSTS },
  backpack: { label: 'Mochila / vehículo', costs: BACKPACK_COSTS },
}

export const DEALER_HIRE_COST = 150
export const BUSINESS_BASE_COST = 200
/** Cada negocio tapadera adicional cuesta más */
export const businessCost = (owned: number): number => BUSINESS_BASE_COST * (owned + 1)

/** Mover el HQ es gratis cada 7 días (GDD §5) */
export const HQ_MOVE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

/** Dinero limpio con el que empieza el jugador (para comprar el primer negocio tapadera) */
export const START_CLEAN_CASH = 250

// --- Idle ---
/** Un camello vende 1 unidad cada tanto */
export const DEALER_INTERVAL_MS = 30_000
/** Los camellos cobran su parte: reciben este factor del precio */
export const DEALER_CUT = 0.8
/** Cada negocio blanquea este Dinero Sucio por tick */
export const LAUNDER_TICK_MS = 10_000
export const LAUNDER_DIRTY_PER_TICK = 5
/** Cuánto sale limpio de cada Dinero Sucio blanqueado */
export const LAUNDER_YIELD = 0.8
/** El progreso offline de camellos y blanqueo se limita a 8 h */
export const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000

// --- Recetas del laboratorio ---
export type RecipeId = 'hierba' | 'cristal' | 'polvo'

export interface Recipe {
  id: RecipeId
  output: ItemId
  inputs: Partial<Record<ItemId, number>>
  /** Segundos por lote con el laboratorio a nivel 1 */
  baseSeconds: number
  minLab: number
  /** Reputación mínima (Tier) */
  minRep: number
}

export const RECIPES: Record<RecipeId, Recipe> = {
  hierba: { id: 'hierba', output: 'hierba', inputs: { fertilizante: 2 }, baseSeconds: 20, minLab: 1, minRep: 0 },
  cristal: { id: 'cristal', output: 'cristal', inputs: { quimicos: 2, baterias: 1 }, baseSeconds: 60, minLab: 2, minRep: 100 },
  polvo: { id: 'polvo', output: 'polvo', inputs: { quimicos: 3, baterias: 2 }, baseSeconds: 150, minLab: 3, minRep: 500 },
}

/** Cada nivel de laboratorio acelera la producción un 50 % */
export const labSpeed = (level: number): number => 1 + 0.5 * (level - 1)
/** Pureza: cada nivel de laboratorio sube el precio de venta de la mercancía un 10 % */
export const purityMult = (level: number): number => 1 + 0.1 * (level - 1)

// --- Reputación ---
export const REP_PER_UNIT: Record<ItemId, number> = {
  quimicos: 0,
  fertilizante: 0,
  baterias: 0,
  hierba: 1,
  cristal: 3,
  polvo: 8,
}
