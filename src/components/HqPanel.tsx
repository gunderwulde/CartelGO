import { useState } from 'react'
import { X } from 'lucide-react'
import { ITEMS, type ItemId } from '../data/items'
import {
  DEALER_HIRE_COST,
  DEALER_SLOTS,
  HQ_MOVE_COOLDOWN_MS,
  LAB_NAMES,
  MAX_LEVEL,
  RECIPES,
  UPGRADE_INFO,
  businessCost,
  type UpgradeKind,
} from '../data/buildings'
import { POI_KINDS } from '../data/poiKinds'
import { isNearHq, storageCap, useBaseStore, type ActionResult } from '../store/baseStore'
import { useInventoryStore } from '../store/inventoryStore'
import { usePlayerStore } from '../store/playerStore'
import { batchDurationMs } from '../services/idleEngine'
import { haversine } from '../services/geoService'
import { carried } from '../services/tradeEngine'
import { useNow } from '../services/useIdle'
import { play, type Sfx } from '../services/sound'
import { requestNotifyPermission } from '../services/notify'
import { fmtTime } from '../services/fmt'
import { CARRIER_HIRE_COST, CARRIER_SLOTS } from '../data/supply'
import { CarrierCard, SupplierCard } from './SupplyCards'

type Tab = 'almacen' | 'lab' | 'camellos' | 'suministro' | 'mejoras'
const TABS: { id: Tab; label: string }[] = [
  { id: 'almacen', label: 'Almacén' },
  { id: 'lab', label: 'Lab' },
  { id: 'camellos', label: 'Camellos' },
  { id: 'suministro', label: 'Suministro' },
  { id: 'mejoras', label: 'Mejoras' },
]

export default function HqPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('almacen')
  const base = useBaseStore()
  const inv = useInventoryStore()
  const position = usePlayerStore((s) => s.position)
  const setNotice = useInventoryStore((s) => s.setNotice)
  const now = useNow(1000)

  const report = (r: ActionResult, sfx: Sfx = 'tap'): void => {
    play(r.ok ? sfx : 'error')
    setNotice(r.ok ? r.message : r.reason)
  }
  const atHq = isNearHq(base.hq, position)

  const btn = 'cartoon-btn px-3 py-1.5 text-sm disabled:opacity-40'

  const storage = (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-black">
        Almacén {carried(base.storage)}/{storageCap(base.storageLevel)} · Mochila {carried(inv.inventory)}/{inv.capacity}
      </p>
      {!atHq && (
        <p className="text-xs font-bold bg-yellow-200 border-2 border-black p-2">
          Estás lejos del HQ: puedes mirar y cocinar, pero para mover mercancía tienes que ir hasta allí.
        </p>
      )}
      {(Object.keys(ITEMS) as ItemId[]).map((id) => (
        <div key={id} className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-black leading-tight truncate">{ITEMS[id].label}</p>
            <p className="text-xs font-bold opacity-70">
              mochila {inv.inventory[id] ?? 0} · almacén {base.storage[id] ?? 0}
            </p>
          </div>
          <button className={btn} disabled={!atHq} onClick={() => report(base.transfer('deposit', id, 999))}>
            Guardar
          </button>
          <button className={`${btn} bg-white!`} disabled={!atHq} onClick={() => report(base.transfer('withdraw', id, 999))}>
            Sacar
          </button>
        </div>
      ))}
    </div>
  )

  const job = base.job
  const lab = (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-black">
        {LAB_NAMES[base.labLevel - 1]} (nivel {base.labLevel})
      </p>
      {job ? (
        <div className="border-4 border-black p-2 bg-green-100">
          <p className="font-black">
            Cocinando {ITEMS[RECIPES[job.recipe].output].label}: quedan {job.remaining}
          </p>
          <p className="text-xs font-bold">
            Siguiente lote en {fmtTime(job.nextAt - now)} · todo listo en{' '}
            {fmtTime(job.nextAt - now + (job.remaining - 1) * batchDurationMs(job.recipe, base.labLevel))}
          </p>
        </div>
      ) : (
        <p className="text-xs font-bold">El laboratorio está parado. Los precursores salen del almacén.</p>
      )}
      {Object.values(RECIPES).map((r) => {
        const locked = base.labLevel < r.minLab || base.reputation < r.minRep
        return (
          <div key={r.id} className={`border-4 border-black p-2 ${locked ? 'opacity-60' : ''}`}>
            <p className="font-black">{ITEMS[r.output].label}</p>
            <p className="text-xs font-bold">
              {(Object.entries(r.inputs) as [ItemId, number][]).map(([i, n]) => `${n}× ${ITEMS[i].label}`).join(' + ')} ·{' '}
              {fmtTime(batchDurationMs(r.id, base.labLevel))} por lote
            </p>
            {locked ? (
              <p className="text-xs font-black text-red-600">
                Requiere {LAB_NAMES[r.minLab - 1]}
                {r.minRep > 0 ? ` y ${r.minRep} de reputación` : ''}
              </p>
            ) : (
              <div className="flex gap-2 mt-1">
                <button className={btn} onClick={() => { void requestNotifyPermission(); report(base.startJob(r.id, 1)) }}>
                  Cocinar 1
                </button>
                <button className={`${btn} bg-white!`} onClick={() => { void requestNotifyPermission(); report(base.startJob(r.id, 999)) }}>
                  Cocinar máx
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  const taken = new Set(base.dealers.map((d) => d.poiId))
  const candidates = Object.values(base.visited)
    .filter((p) => (p.kind === 'park' || p.kind === 'nightlife') && !taken.has(p.id))
    .map((p) => ({ p, d: position ? haversine(position, p) : 0 }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 10)
  const dealers = (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-black">
        Camellos {base.dealers.length}/{DEALER_SLOTS[base.hqLevel - 1]} · venden 1 unidad cada 30 s del almacén (cobran su parte)
      </p>
      {base.dealers.map((d) => (
        <div key={d.id} className="flex items-center gap-2">
          <span className="flex-1 font-black truncate">{d.name ?? POI_KINDS[d.kind].label}</span>
          <button className={`${btn} bg-white!`} onClick={() => base.fireDealer(d.id)}>
            Despedir
          </button>
        </div>
      ))}
      <p className="text-sm font-black mt-2">Lugares que ya conoces</p>
      {candidates.length === 0 && (
        <p className="text-xs font-bold">Visita parques y bares (a menos de 150 m) para poder asignarles un camello.</p>
      )}
      {candidates.map(({ p }) => (
        <div key={p.id} className="flex items-center gap-2">
          <span className="flex-1 font-bold truncate">{p.name ?? POI_KINDS[p.kind].label}</span>
          <button className={btn} onClick={() => report(base.hireDealer(p), 'level')}>
            Contratar ${DEALER_HIRE_COST}
          </button>
        </div>
      ))}
    </div>
  )

  const supplierList = Object.values(base.suppliers)
  const supply = (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-black">
        Transportistas {base.carriers.length}/{CARRIER_SLOTS[base.hqLevel - 1]}
      </p>
      <p className="text-xs font-bold">
        Los puntos de suministro preparan tu pedido y un transportista libre lo recoge y lo trae al almacén. Sin transportistas no llega nada.
      </p>
      {base.carriers.map((c, i) => (
        <CarrierCard key={c.id} carrier={c} index={i} />
      ))}
      <button className={btn} onClick={() => report(base.hireCarrier(), 'level')}>
        Contratar transportista ${CARRIER_HIRE_COST}
      </button>

      <p className="text-sm font-black mt-2">Puntos de suministro ({supplierList.length})</p>
      {supplierList.length === 0 && (
        <p className="text-xs font-bold">
          Ve en persona a un almacén o una farmacia y pulsa «Establecer contacto». Solo hace falta la primera vez.
        </p>
      )}
      {supplierList.map((sp) => (
        <SupplierCard key={sp.poi.id} supplier={sp} />
      ))}
    </div>
  )

  const upgrades = (
    <div className="flex flex-col gap-3">
      {(Object.keys(UPGRADE_INFO) as UpgradeKind[]).map((k) => {
        const level = { hq: base.hqLevel, lab: base.labLevel, storage: base.storageLevel, backpack: base.backpackLevel }[k]
        const max = level >= MAX_LEVEL
        return (
          <div key={k} className="flex items-center gap-2">
            <div className="flex-1">
              <p className="font-black leading-tight">{UPGRADE_INFO[k].label}</p>
              <p className="text-xs font-bold opacity-70">Nivel {level}/{MAX_LEVEL}</p>
            </div>
            <button className={btn} disabled={max} onClick={() => report(base.upgrade(k), 'level')}>
              {max ? 'Máx' : `$${UPGRADE_INFO[k].costs[level]}`}
            </button>
          </div>
        )
      })}
      <p className="text-xs font-bold">Los edificios no pueden superar el nivel del Cuartel General.</p>

      <p className="text-sm font-black mt-2">Negocios tapadera ({base.businesses.length})</p>
      {base.businesses.length === 0 && (
        <p className="text-xs font-bold">
          Ve a una lavandería o autolavado y cómpralo (${businessCost(0)} limpios) para blanquear dinero solo.
        </p>
      )}
      {base.businesses.map((b) => (
        <p key={b.poiId} className="text-sm font-bold">
          • {b.name ?? 'Negocio sin nombre'}
        </p>
      ))}

      <button
        className={`${btn} mt-2`}
        disabled={!position}
        onClick={() => {
          if (!position) return
          report(base.placeHq(position))
        }}
      >
        Mover el HQ aquí
      </button>
      {base.hq && Date.now() - base.hq.movedAt < HQ_MOVE_COOLDOWN_MS && (
        <p className="text-xs font-bold">
          Gratis de nuevo en {fmtTime(HQ_MOVE_COOLDOWN_MS - (Date.now() - base.hq.movedAt))}.
        </p>
      )}
    </div>
  )

  return (
    <div className="fixed inset-0 z-30 bg-yellow-300 flex flex-col pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="px-4 pb-2 flex items-start gap-3">
        <div className="flex-1">
          <p className="text-2xl font-black leading-tight">Cuartel General</p>
          <p className="text-sm font-black">
            Sucio ${inv.dirtyCash} · Limpio ${inv.cleanCash} · Rep {base.reputation}
          </p>
        </div>
        <button aria-label="Cerrar" onClick={onClose}>
          <X size={28} />
        </button>
      </div>
      <div className="px-4 flex gap-1 pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`cartoon-btn flex-1 py-1.5 text-xs ${tab === t.id ? '' : 'bg-white!'}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="cartoon-card p-3">
          {tab === 'almacen' && storage}
          {tab === 'lab' && lab}
          {tab === 'camellos' && dealers}
          {tab === 'suministro' && supply}
          {tab === 'mejoras' && upgrades}
        </div>
      </div>
    </div>
  )
}
