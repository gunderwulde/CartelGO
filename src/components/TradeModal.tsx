import { X } from 'lucide-react'
import type { Poi } from '../types/poi'
import { ITEMS, type ItemId } from '../data/items'
import { POI_KINDS } from '../data/poiKinds'
import { PoiBadge } from './PoiBadge'
import { useInventoryStore } from '../store/inventoryStore'
import { useBaseStore } from '../store/baseStore'
import { businessCost, purityMult } from '../data/buildings'
import { play } from '../services/sound'
import { carried, dailyRemaining, offersFor, unitPrice } from '../services/tradeEngine'

interface Props {
  poi: Poi
  blocked: boolean
  onClose: () => void
}

export default function TradeModal({ poi, blocked, onClose }: Props) {
  const inventory = useInventoryStore((s) => s.inventory)
  const dirtyCash = useInventoryStore((s) => s.dirtyCash)
  const capacity = useInventoryStore((s) => s.capacity)
  const limits = useInventoryStore((s) => s.limits)
  const trade = useInventoryStore((s) => s.trade)
  const setNotice = useInventoryStore((s) => s.setNotice)
  const labLevel = useBaseStore((s) => s.labLevel)
  const businesses = useBaseStore((s) => s.businesses)
  const cleanCash = useInventoryStore((s) => s.cleanCash)
  const mult = purityMult(labLevel)

  const now = new Date()
  const offers = offersFor(poi.kind)
  const info = POI_KINDS[poi.kind]
  const remaining = dailyRemaining(poi, limits, now)

  const act = (mode: 'buy' | 'sell', item: ItemId, qty: number): void => {
    const r = trade(mode, poi, item, qty, mode === 'sell' ? mult : 1)
    if (r.ok && mode === 'sell') useBaseStore.getState().addSaleReputation(item, r.qty)
    play(r.ok ? mode : 'error')
    setNotice(
      r.ok
        ? `${mode === 'buy' ? 'Comprado' : 'Vendido'}: ${r.qty} × ${ITEMS[item].label} por $${r.total}`
        : r.reason,
    )
  }

  const row = (mode: 'buy' | 'sell', item: ItemId) => {
    const price = mode === 'sell' ? Math.round(unitPrice(poi.kind, item, now) * mult) : unitPrice(poi.kind, item, now)
    const owned = inventory[item] ?? 0
    return (
      <div key={`${mode}-${item}`} className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-black leading-tight truncate">{ITEMS[item].label}</p>
          <p className="text-xs font-bold opacity-70">
            ${price} c/u · llevas {owned}
          </p>
        </div>
        <button className="cartoon-btn px-3 py-2 text-sm" disabled={blocked} onClick={() => act(mode, item, 1)}>
          {mode === 'buy' ? 'Comprar 1' : 'Vender 1'}
        </button>
        <button className="cartoon-btn px-3 py-2 text-sm bg-white!" disabled={blocked} onClick={() => act(mode, item, 999)}>
          {mode === 'buy' ? 'Máx' : 'Todo'}
        </button>
      </div>
    )
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 max-h-[70%] overflow-y-auto cartoon-card rounded-t-2xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="flex items-start gap-2 mb-3">
        <PoiBadge kind={poi.kind} size={36} />
        <div className="flex-1 min-w-0">
          <p className="font-black text-lg leading-tight truncate">{poi.name ?? info.label}</p>
          <p className="text-xs font-bold opacity-70">
            {info.label} · {info.role}
          </p>
        </div>
        <button aria-label="Cerrar" onClick={onClose}>
          <X />
        </button>
      </div>

      <p className="text-sm font-black mb-2">
        ${dirtyCash} sucios · mochila {carried(inventory)}/{capacity}
      </p>

      {blocked && <p className="text-sm font-black text-red-600 mb-2">Vas demasiado rápido. Nada de negocios al volante.</p>}

      <div className="flex flex-col gap-3">
        {offers.buy.map((i) => row('buy', i))}
        {offers.sell.map((i) => row('sell', i))}
        {poi.kind === 'pharmacy' && <p className="text-xs font-bold">Te quedan {remaining} unidades hoy en esta farmacia.</p>}
        {poi.kind === 'cover' && (
          <div>
            {businesses.some((b) => b.poiId === poi.id) ? (
              <p className="text-sm font-black">Es tuyo: blanquea dinero automáticamente.</p>
            ) : (
              <>
                <p className="text-sm font-bold mb-2">
                  Cómpralo para blanquear Dinero Sucio solo (te quedas el 80 %). Tienes ${cleanCash} limpios.
                </p>
                <button
                  className="cartoon-btn px-3 py-2 text-sm"
                  disabled={blocked}
                  onClick={() => {
                    const r = useBaseStore.getState().buyBusiness(poi)
                    play(r.ok ? 'level' : 'error')
                    setNotice(r.ok ? r.message : r.reason)
                  }}
                >
                  Comprar ${businessCost(businesses.length)}
                </button>
              </>
            )}
          </div>
        )}
        {offers.buy.length === 0 && offers.sell.length === 0 && poi.kind !== 'cover' && (
          <p className="text-sm font-bold">
            Aquí no se hacen negocios. Aléjate, que te estás calentando.
          </p>
        )}
      </div>
    </div>
  )
}
