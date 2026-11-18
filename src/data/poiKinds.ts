import { Martini, Pill, Siren, Trees, Warehouse, WashingMachine, type LucideIcon } from 'lucide-react'
import type { PoiKind } from '../types/poi'

export interface PoiKindInfo {
  label: string
  role: string
  color: string
  /** Icono (lucide) que identifica el tipo de lugar en el mapa y en la interfaz */
  Icon: LucideIcon
}

/** Catálogo de roles de lugar (GDD §3). */
export const POI_KINDS: Record<PoiKind, PoiKindInfo> = {
  warehouse: { label: 'Almacén clandestino', role: 'Precursores al por mayor', color: '#a855f7', Icon: Warehouse },
  pharmacy: { label: 'Suministro químico', role: 'Ingredientes refinados', color: '#22c55e', Icon: Pill },
  park: { label: 'Punto de menudeo', role: 'Venta rápida, bajo riesgo', color: '#84cc16', Icon: Trees },
  nightlife: { label: 'Zona VIP', role: 'Precio x2 de 20:00 a 04:00', color: '#ec4899', Icon: Martini },
  police: { label: 'Zona caliente', role: 'Aumenta el Heat', color: '#3b82f6', Icon: Siren },
  cover: { label: 'Negocio tapadera', role: 'Blanqueo de dinero', color: '#f97316', Icon: WashingMachine },
}

/** Radio de influencia de una comisaría (m). Valor de diseño provisional. */
export const POLICE_INFLUENCE_RADIUS_M = 150
