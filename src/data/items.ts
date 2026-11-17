export type ItemId = 'quimicos' | 'fertilizante' | 'baterias' | 'hierba' | 'cristal' | 'polvo'

export type ItemCategory = 'precursor' | 'product'

export interface ItemInfo {
  id: ItemId
  label: string
  category: ItemCategory
  /** Precio de referencia en Dinero Sucio por unidad */
  basePrice: number
}

/** Catálogo (GDD §4). Todos los nombres son ficticios (AGENTS §3). */
export const ITEMS: Record<ItemId, ItemInfo> = {
  quimicos: { id: 'quimicos', label: 'Químicos básicos', category: 'precursor', basePrice: 10 },
  fertilizante: { id: 'fertilizante', label: 'Fertilizante', category: 'precursor', basePrice: 6 },
  baterias: { id: 'baterias', label: 'Baterías', category: 'precursor', basePrice: 8 },
  hierba: { id: 'hierba', label: 'Hierba Risona', category: 'product', basePrice: 30 },
  cristal: { id: 'cristal', label: 'Cristal Azul', category: 'product', basePrice: 90 },
  polvo: { id: 'polvo', label: 'Polvo Estelar', category: 'product', basePrice: 250 },
}

export const PRECURSORS: ItemId[] = ['quimicos', 'fertilizante', 'baterias']
export const PRODUCTS: ItemId[] = ['hierba', 'cristal', 'polvo']
