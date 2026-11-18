import { CFG } from "./config";

export type ItemId =
  "quimicos" | "fertilizante" | "baterias" | "hierba" | "cristal" | "polvo";

export type ItemCategory = "precursor" | "product";

export interface ItemInfo {
  id: ItemId;
  label: string;
  category: ItemCategory;
  /** Precio de referencia en Dinero Sucio por unidad */
  basePrice: number;
}

/** Catálogo (GDD §4). Todos los nombres son ficticios (AGENTS §3). */
export const ITEMS: Record<ItemId, ItemInfo> = {
  quimicos: {
    id: "quimicos",
    label: "Químicos básicos",
    category: "precursor",
    basePrice: CFG.productos.quimicos.precio,
  },
  fertilizante: {
    id: "fertilizante",
    label: "Fertilizante",
    category: "precursor",
    basePrice: CFG.productos.fertilizante.precio,
  },
  baterias: {
    id: "baterias",
    label: "Baterías",
    category: "precursor",
    basePrice: CFG.productos.baterias.precio,
  },
  hierba: {
    id: "hierba",
    label: "Hierba Risona",
    category: "product",
    basePrice: CFG.productos.hierba.precio,
  },
  cristal: {
    id: "cristal",
    label: "Cristal Azul",
    category: "product",
    basePrice: CFG.productos.cristal.precio,
  },
  polvo: {
    id: "polvo",
    label: "Polvo Estelar",
    category: "product",
    basePrice: CFG.productos.polvo.precio,
  },
};

export const PRECURSORS: ItemId[] = ["quimicos", "fertilizante", "baterias"];
export const PRODUCTS: ItemId[] = ["hierba", "cristal", "polvo"];
