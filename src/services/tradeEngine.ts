import { ITEMS, PRECURSORS, PRODUCTS, type ItemId } from "../data/items";
import { HAND_SALE_CUT, HAND_SALE_HEAT, REP_PER_UNIT } from "../data/buildings";
import {
  NIGHT_END_HOUR,
  NIGHT_FACTOR,
  NIGHT_START_HOUR,
  WAREHOUSE_FACTOR,
} from "../data/balance";
import type { PoiKind } from "../types/poi";

/** Existencias por producto (el almacén del HQ) */
export type Inventory = Partial<Record<ItemId, number>>;

export const isNight = (d: Date): boolean =>
  d.getHours() >= NIGHT_START_HOUR || d.getHours() < NIGHT_END_HOUR;

/** Unidades totales en unas existencias */
export const carried = (inv: Inventory): number =>
  Object.values(inv).reduce((a, b) => a + (b ?? 0), 0);

/** Qué se le puede pedir a cada tipo de lugar (el jugador ya no vende a mano: lo hacen sus camellos). */
export function offersFor(kind: PoiKind): { buy: ItemId[] } {
  switch (kind) {
    case "supermarket":
      // Solo lo doméstico: fertilizantes y baterías
      return { buy: ["fertilizante", "baterias"] };
    case "warehouse":
    case "pharmacy":
      // Sin almacenes cerca el juego no puede quedarse bloqueado: la farmacia vende todo, pero a precio normal
      return { buy: PRECURSORS };
    default:
      return { buy: [] };
  }
}

/** Precio unitario en Dinero Sucio. */
export function unitPrice(kind: PoiKind, item: ItemId, now: Date): number {
  const base = ITEMS[item].basePrice;
  if (kind === "warehouse")
    return Math.max(1, Math.round(base * WAREHOUSE_FACTOR));
  if (kind === "nightlife")
    return Math.round(base * (isNight(now) ? NIGHT_FACTOR : 1));
  return base;
}

export type HandSale =
  | { ok: true; qty: number; cash: number; heat: number; rep: number }
  | { ok: false; reason: string };

/**
 * Venta a mano en un parque o bar, sacando del almacén del HQ (no hay mochila).
 * Cobras el precio completo (los camellos se quedan una parte), a cambio de Heat por unidad.
 */
export function planHandSale(
  storage: Inventory,
  item: ItemId,
  requested: number,
  kind: PoiKind,
  now: Date,
): HandSale {
  if (kind !== "park" && kind !== "nightlife")
    return { ok: false, reason: "Aquí no se vende." };
  if (!PRODUCTS.includes(item))
    return { ok: false, reason: "Eso no se vende a mano: es materia prima." };
  const qty = Math.min(Math.floor(requested), storage[item] ?? 0);
  if (qty < 1) return { ok: false, reason: "No tienes de eso en el almacén." };
  return {
    ok: true,
    qty,
    cash: Math.round(qty * unitPrice(kind, item, now) * HAND_SALE_CUT),
    heat: qty * HAND_SALE_HEAT,
    rep: qty * REP_PER_UNIT[item],
  };
}
