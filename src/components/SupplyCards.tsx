import { ITEMS, type ItemId } from '../data/items'
import {
  CARRIER_LEVELS,
  CARRIER_UPGRADE_COSTS,
  REMOTE_UPGRADE_FACTOR,
  SUPPLIER_LEVELS,
  SUPPLY_MAX_LEVEL,
} from '../data/supply'
import { POI_KINDS } from '../data/poiKinds'
import { useBaseStore, type ActionResult } from '../store/baseStore'
import { useInventoryStore } from '../store/inventoryStore'
import { usePlayerStore } from '../store/playerStore'
import { haversine, INTERACTION_RADIUS_M } from '../services/geoService'
import { fmtTime } from '../services/fmt'
import { play } from '../services/sound'
import { offersFor, unitPrice } from '../services/tradeEngine'
import { supplierUpgradeCost, type Carrier, type Supplier } from '../services/supplyEngine'
import { useNow } from '../services/useIdle'
import { PoiBadge } from './PoiBadge'

const btn = 'cartoon-btn px-3 py-1.5 text-sm disabled:opacity-40'

function report(r: ActionResult, sfx: 'level' | 'tap' = 'tap'): void {
  play(r.ok ? sfx : 'error')
  useInventoryStore.getState().setNotice(r.ok ? r.message : r.reason)
}

/** Punto de suministro con contacto: estado del pedido, pedir y mejorar. */
export function SupplierCard({ supplier, blocked = false }: { supplier: Supplier; blocked?: boolean }) {
  const now = useNow(1000)
  const carriers = useBaseStore((s) => s.carriers)
  const position = usePlayerStore((s) => s.position)
  const orderSupply = useBaseStore((s) => s.orderSupply)
  const upgradeSupplier = useBaseStore((s) => s.upgradeSupplier)
  const { poi, level, order } = supplier
  const info = SUPPLIER_LEVELS[level - 1]
  const near = !!position && haversine(position, poi) <= INTERACTION_RADIUS_M
  const upCost = supplierUpgradeCost(level, !near)
  const trip = carriers.find((c) => c.trip?.supplierId === poi.id)?.trip

  return (
    <div className="border-4 border-black p-2 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <PoiBadge kind={poi.kind} size={28} />
        <div className="flex-1 min-w-0">
          <p className="font-black leading-tight truncate">{poi.name ?? POI_KINDS[poi.kind].label}</p>
          <p className="text-xs font-bold opacity-70">
            Nivel {level}/{SUPPLY_MAX_LEVEL} · prepara en {fmtTime(info.prepMs)} · hasta {info.maxQty} uds
          </p>
        </div>
      </div>

      {order && (
        <p className="text-xs font-black bg-green-100 border-2 border-black p-1.5">
          {order.readyAt > now
            ? `Preparando ${order.qty} × ${ITEMS[order.item].label}: listo en ${fmtTime(order.readyAt - now)}`
            : `Listo: ${order.qty} × ${ITEMS[order.item].label} esperando transportista`}
        </p>
      )}
      {trip && (
        <p className="text-xs font-black bg-blue-100 border-2 border-black p-1.5">
          Transportista en camino con {trip.qty} × {ITEMS[trip.item].label}: llega en {fmtTime(trip.arriveAt - now)}
        </p>
      )}

      {offersFor(poi.kind).buy.map((item: ItemId) => (
        <div key={item} className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-bold leading-tight truncate">{ITEMS[item].label}</p>
            <p className="text-xs font-bold opacity-70">${unitPrice(poi.kind, item, new Date(now))} c/u</p>
          </div>
          <button className={btn} disabled={blocked || !!order} onClick={() => report(orderSupply(poi.id, item, 10))}>
            Pedir 10
          </button>
          <button className={`${btn} bg-white!`} disabled={blocked || !!order} onClick={() => report(orderSupply(poi.id, item, 999))}>
            Máx
          </button>
        </div>
      ))}

      <div className="flex items-center gap-2">
        <p className="flex-1 text-xs font-bold">
          {upCost === null
            ? 'Distribución al máximo.'
            : near
              ? 'Estás aquí: negocias en persona.'
              : `Por teléfono cuesta x${REMOTE_UPGRADE_FACTOR}. Ve al sitio para el precio normal.`}
        </p>
        <button className={btn} disabled={blocked || upCost === null} onClick={() => report(upgradeSupplier(poi.id), 'level')}>
          {upCost === null ? 'Máx' : `Mejorar $${upCost}`}
        </button>
      </div>
    </div>
  )
}

/** Transportista contratado: estado del viaje y mejora. */
export function CarrierCard({ carrier, index }: { carrier: Carrier; index: number }) {
  const now = useNow(1000)
  const suppliers = useBaseStore((s) => s.suppliers)
  const upgradeCarrier = useBaseStore((s) => s.upgradeCarrier)
  const info = CARRIER_LEVELS[carrier.level - 1]
  const max = carrier.level >= SUPPLY_MAX_LEVEL
  const from = carrier.trip ? suppliers[carrier.trip.supplierId]?.poi.name : null

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <p className="font-black leading-tight">
          Transportista {index + 1} · nivel {carrier.level}/{SUPPLY_MAX_LEVEL}
        </p>
        <p className="text-xs font-bold opacity-70">
          viaje de {fmtTime(info.tripMs)} · {info.capacity} uds ·{' '}
          {carrier.trip
            ? `lleva ${carrier.trip.qty} × ${ITEMS[carrier.trip.item].label}${from ? ` de ${from}` : ''}, llega en ${fmtTime(carrier.trip.arriveAt - now)}`
            : 'libre'}
        </p>
      </div>
      <button className={btn} disabled={max} onClick={() => report(upgradeCarrier(carrier.id), 'level')}>
        {max ? 'Máx' : `$${CARRIER_UPGRADE_COSTS[carrier.level]}`}
      </button>
    </div>
  )
}
