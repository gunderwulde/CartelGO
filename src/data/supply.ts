/**
 * Cadena de suministro (GDD §4 bis). Los números viven en balance.json.
 * El primer contacto con un punto es en persona; después se piden envíos y un transportista los lleva al HQ.
 */
import { CFG, sec } from "./config";

export const SUPPLY_MAX_LEVEL = CFG.suministro.proveedores.length;

export interface SupplierLevel {
  /** Tiempo que tarda el punto en preparar un pedido (ms) */
  prepMs: number;
  /** Unidades máximas por pedido */
  maxQty: number;
}

/** Índice = nivel - 1. El nivel 1 es el contacto inicial. */
export const SUPPLIER_LEVELS: SupplierLevel[] = CFG.suministro.proveedores.map(
  (p) => ({
    prepMs: sec(p.preparaSegundos),
    maxQty: p.maxUnidades,
  }),
);

/** Dinero Limpio para llegar al nivel N (índice N-1) negociando en persona. */
export const SUPPLIER_UPGRADE_COSTS: number[] = CFG.suministro.proveedores.map(
  (p) => p.costeMejora,
);
/** Negociar por teléfono multiplica el precio de la mejora */
export const REMOTE_UPGRADE_FACTOR = CFG.suministro.factorMejoraPorTelefono;

export interface CarrierLevel {
  /** Duración del viaje de recogida y entrega (ms) */
  tripMs: number;
  /** Unidades por viaje */
  capacity: number;
}

export const CARRIER_LEVELS: CarrierLevel[] = CFG.suministro.transportistas.map(
  (t) => ({
    tripMs: sec(t.viajeSegundos),
    capacity: t.capacidad,
  }),
);
export const CARRIER_HIRE_COST = CFG.suministro.costeContratarTransportista;
export const CARRIER_UPGRADE_COSTS: number[] =
  CFG.suministro.transportistas.map((t) => t.costeMejora);
/** Transportistas máximos por nivel de HQ */
export const CARRIER_SLOTS: number[] = CFG.edificios.huecosTransportistas;

/** Ensuciar dinero: de cada Dinero Limpio que cambias, el cambista te da esta parte en Dinero Sucio (se queda con el resto) */
export const DIRTY_EXCHANGE_YIELD = CFG.suministro.rendimientoEnsuciar;
/** Importes (limpios) que ofrece el HQ para ensuciar */
export const DIRTY_EXCHANGE_STEPS: number[] = CFG.suministro.importesEnsuciar;
