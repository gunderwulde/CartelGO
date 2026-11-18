import type { ItemId } from "./items";
import { CFG, sec } from "./config";

const E = CFG.edificios;
const D = CFG.camellos;
const N = CFG.negocios;

/** Nivel máximo de cada edificio. El HQ limita al resto (GDD §5). Todos los números viven en balance.json. */
export const MAX_LEVEL = E.nivelMaximo;

/** Coste en Dinero Limpio para llegar al nivel N (índice N-1). */
export const HQ_COSTS: number[] = E.costeHQ;
export const LAB_COSTS: number[] = E.costeLaboratorio;
export const STORAGE_COSTS: number[] = E.costeAlmacen;

export const STORAGE_CAPACITY: number[] = E.capacidadAlmacen;
/** Camellos máximos por nivel de HQ */
export const DEALER_SLOTS: number[] = E.huecosCamellos;

export const LAB_NAMES = [
  "Cocina de garaje",
  "Laboratorio Básico",
  "Laboratorio Avanzado",
];

export type UpgradeKind = "hq" | "lab" | "storage";

export const UPGRADE_INFO: Record<
  UpgradeKind,
  { label: string; costs: number[] }
> = {
  hq: { label: "Cuartel General", costs: HQ_COSTS },
  lab: { label: "Laboratorio", costs: LAB_COSTS },
  storage: { label: "Almacén", costs: STORAGE_COSTS },
};

export const DEALER_HIRE_COST = D.costeContratar;
/** Al despedir a un camello se recupera esta parte de lo que costó contratarlo (en Dinero Limpio) */
export const REFUND_SHARE = D.reembolsoAlDespedir;

// --- Camellos: lealtad, robo y adulteración (GDD §4 quater) ---
/** Cada camello tiene una fiabilidad 0-100. Prob. de cada sablazo por venta = BASE × (1 - fiabilidad/100) */
export const DEALER_THEFT_BASE = D.probRoboBase;
export const DEALER_CUT_BASE = D.probAdulteracionBase;
/** Fracción de la venta que se queda el camello cuando roba */
export const DEALER_THEFT_SHARE = D.parteQueSeQuedanEnRobo;
/** Fracción de la venta que cobras cuando el camello adultera el producto */
export const DEALER_CUT_PAYOUT = D.parteQueCobrasEnAdulteracion;
/** Una adulteración sube el Heat y quita reputación */
export const DEALER_CUT_HEAT = D.calorPorAdulteracion;
export const DEALER_CUT_REP_LOSS = D.reputacionPerdidaPorAdulteracion;
/** Los camellos dan esta parte de la reputación por unidad vendida (1 = la reputación completa del producto) */
export const DEALER_REP_SHARE = D.parteDeReputacion;
/** Ventas necesarias para conocer de verdad a un camello (hasta entonces su fiabilidad es un misterio) */
export const DEALER_REVEAL_SALES = D.ventasParaConocerlo;
/** Prima de lealtad: se paga en Dinero Sucio y sube la fiabilidad */
export const DEALER_BONUS_COST = D.primaCoste;
export const DEALER_BONUS_HONESTY = D.primaFiabilidad;

export const BUSINESS_BASE_COST = N.costes[0];
/** Coste (en Dinero Sucio) del siguiente negocio según los que ya tienes. Pasada la lista, cada uno cuesta N.multiplicadorMasAlla veces el anterior. */
export const businessCost = (owned: number): number => {
  const list = N.costes;
  if (owned < list.length) return list[owned];
  return Math.round(
    list[list.length - 1] * N.multiplicadorMasAlla ** (owned - list.length + 1),
  );
};

/** Mover el HQ es gratis cada 7 días (GDD §5) */
export const HQ_MOVE_COOLDOWN_MS =
  E.diasEntreMovimientosHQ * 24 * 60 * 60 * 1000;

/** Dinero limpio inicial */
export const START_CLEAN_CASH = CFG.inicio.dineroLimpio;

// --- Idle ---
/** Un camello vende 1 unidad cada tanto */
export const DEALER_INTERVAL_MS = sec(D.segundosEntreVentas);
/** Los camellos cobran su parte: reciben este factor del precio */
export const DEALER_CUT = D.parteQueCobran;
/** Cada negocio blanquea este Dinero Sucio por tick */
export const LAUNDER_TICK_MS = sec(N.segundosPorTick);
export const LAUNDER_DIRTY_PER_TICK = N.sucioPorTick;
/** Cuánto sale limpio de cada Dinero Sucio blanqueado */
export const LAUNDER_YIELD = N.rendimientoLimpio;
/** El progreso offline de camellos y blanqueo se limita a estas horas */
export const OFFLINE_CAP_MS = CFG.offline.limiteHoras * 60 * 60 * 1000;

// --- Recetas del laboratorio ---
export type RecipeId = "hierba" | "cristal" | "polvo";

export interface Recipe {
  id: RecipeId;
  output: ItemId;
  inputs: Partial<Record<ItemId, number>>;
  /** Segundos por lote con el laboratorio a nivel 1 */
  baseSeconds: number;
  minLab: number;
  /** Reputación mínima (Tier) */
  minRep: number;
}

const recipe = (id: RecipeId): Recipe => {
  const r = CFG.recetas[id];
  return {
    id,
    output: id,
    inputs: r.ingredientes,
    baseSeconds: r.segundosPorLote,
    minLab: r.minLab,
    minRep: r.minReputacion,
  };
};

export const RECIPES: Record<RecipeId, Recipe> = {
  hierba: recipe("hierba"),
  cristal: recipe("cristal"),
  polvo: recipe("polvo"),
};

/** Cada nivel de laboratorio acelera la producción */
export const labSpeed = (level: number): number =>
  1 + E.laboratorioVelocidadPorNivel * (level - 1);
/** Pureza: cada nivel de laboratorio sube el precio de venta de la mercancía */
export const purityMult = (level: number): number =>
  1 + E.laboratorioPurezaPorNivel * (level - 1);

// --- Reputación ---
export const REP_PER_UNIT: Record<ItemId, number> = {
  quimicos: CFG.productos.quimicos.reputacion,
  fertilizante: CFG.productos.fertilizante.reputacion,
  baterias: CFG.productos.baterias.reputacion,
  hierba: CFG.productos.hierba.reputacion,
  cristal: CFG.productos.cristal.reputacion,
  polvo: CFG.productos.polvo.reputacion,
};
