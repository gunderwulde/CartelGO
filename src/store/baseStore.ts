import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { del, get as idbGet, set as idbSet } from 'idb-keyval'
import {
  DEALER_BONUS_COST,
  DEALER_BONUS_HONESTY,
  DEALER_HIRE_COST,
  DEALER_SLOTS,
  REFUND_SHARE,
  HQ_MOVE_COOLDOWN_MS,
  MAX_LEVEL,
  RECIPES,
  STORAGE_CAPACITY,
  UPGRADE_INFO,
  businessCost,
  type RecipeId,
  type UpgradeKind,
} from '../data/buildings'
import {
  CARRIER_HIRE_COST,
  CARRIER_SLOTS,
  CARRIER_UPGRADE_COSTS,
  SUPPLY_MAX_LEVEL,
} from '../data/supply'
import { ITEMS, type ItemId } from '../data/items'
import type { LatLng } from '../types'
import type { Poi } from '../types/poi'
import {
  syncIdle,
  batchDurationMs,
  honestyOf,
  rollHonesty,
  type Business,
  type Dealer,
  type DealerEvent,
  type IdleState,
  type Job,
} from '../services/idleEngine'
import { carried, type Inventory } from '../services/tradeEngine'
import { AD_RESCUE_REWARD, canOfferAd } from '../services/adRescue'
import { CALM_HEAT_COST, FAVORS_START, favorCost } from '../services/favors'
import {
  advanceSupply,
  dirtyFromClean,
  newCarrier,
  pending,
  planOrder,
  supplierUpgradeCost,
  type Carrier,
  type Suppliers,
} from '../services/supplyEngine'
import { haversine, INTERACTION_RADIUS_M } from '../services/geoService'
import { HEAT_MAX } from '../data/balance'
import { useInventoryStore } from './inventoryStore'
import { usePlayerStore } from './playerStore'

const idbStorage: StateStorage = {
  getItem: async (name) => (await idbGet<string>(name)) ?? null,
  setItem: async (name, value) => idbSet(name, value),
  removeItem: async (name) => del(name),
}

export interface Hq extends LatLng {
  movedAt: number
}

export type ActionResult =
  | { ok: true; message: string }
  /** `confirm`: la acción pide permiso; si el jugador acepta, `accept()` la repite ya autorizada */
  | { ok: false; reason: string; confirm?: { message: string; accept: () => ActionResult } }
const fail = (reason: string): ActionResult => ({ ok: false, reason })
const done = (message: string): ActionResult => ({ ok: true, message })

export type VisitedPoi = Pick<Poi, 'id' | 'kind' | 'name' | 'lat' | 'lng'>

interface BaseState {
  /** Coordenadas exactas del HQ: SOLO en local. Nunca enviar (AGENTS §3) */
  hq: Hq | null
  hqLevel: number
  labLevel: number
  storageLevel: number
  storage: Inventory
  job: Job | null
  dealers: Dealer[]
  /** Informe de sucesos de los camellos (robos y adulteraciones), el más reciente primero */
  dealerLog: DealerEvent[]
  businesses: Business[]
  visited: Record<string, VisitedPoi>
  /** Puntos de suministro con contacto establecido (GDD §4 bis) */
  suppliers: Suppliers
  carriers: Carrier[]
  reputation: number
  dealersAt: number
  launderAt: number
  /** Última vez que se cobró un anuncio de rescate */
  adAt: number
  /** Favores: moneda para saltar esperas */
  favors: number

  placeHq: (pos: LatLng) => ActionResult
  startJob: (recipe: RecipeId, batches: number) => ActionResult
  hireDealer: (poi: VisitedPoi) => ActionResult
  fireDealer: (id: string) => ActionResult
  bonusDealer: (id: string) => ActionResult
  buyBusiness: (poi: VisitedPoi) => ActionResult
  upgrade: (kind: UpgradeKind) => ActionResult
  establishContact: (poi: Poi) => ActionResult
  orderSupply: (poiId: string, item: ItemId, qty: number) => ActionResult
  /** Cambia Dinero Limpio por Dinero Sucio (con comisión) */
  makeDirty: (cleanAmount: number) => ActionResult
  /** Cobra la recompensa del anuncio de rescate */
  claimAdReward: () => ActionResult
  grantFavors: (n: number) => void
  /** Saltar esperas con Favores */
  skipOrder: (poiId: string) => ActionResult
  skipTrip: (carrierId: string) => ActionResult
  skipBatch: () => ActionResult
  calmHeat: () => ActionResult
  upgradeSupplier: (poiId: string) => ActionResult
  hireCarrier: () => ActionResult
  upgradeCarrier: (id: string) => ActionResult
  markVisited: (pois: Poi[]) => void
  /** Redada: la policía se lleva una parte del almacén. Devuelve las unidades confiscadas */
  seizeStock: (share: number) => number
  /** Avanza el idle hasta ahora (producción, camellos y blanqueo) */
  sync: () => void
}

const levelOf = (s: BaseState, kind: UpgradeKind): number =>
  ({ hq: s.hqLevel, lab: s.labLevel, storage: s.storageLevel })[kind]

const DEALER_LOG_MAX = 40

/** Tras aceptar el aviso del juego, la repetición de la acción pasa sin preguntar otra vez */
let authorized = false

/** Gastar Dinero Limpio sin negocio tapadera y sin llegar a comprar uno te deja sin forma de ganar limpio. Devuelve un aviso a confirmar, o null si se puede seguir. */
function okToSpend(s: BaseState, cleanBefore: number, cost: number, retry: () => ActionResult): ActionResult | null {
  if (authorized) {
    authorized = false
    return null
  }
  if (s.businesses.length > 0 || cleanBefore - cost >= businessCost(0)) return null
  return {
    ok: false,
    reason: 'Compra pendiente de confirmar.',
    confirm: {
      message: `Si gastas $${cost} te quedarás sin los $${businessCost(0)} limpios para montar un negocio tapadera, y sin negocio no entra Dinero Limpio. ¿Seguro?`,
      accept: () => {
        authorized = true
        try {
          return retry()
        } finally {
          authorized = false
        }
      },
    },
  }
}

const newDealer = (poi: VisitedPoi): Dealer => {
  const id = `d${Date.now()}`
  return { id, poiId: poi.id, kind: poi.kind as 'park' | 'nightlife', name: poi.name, honesty: rollHonesty(id), sold: 0, earned: 0, stolen: 0, cutUnits: 0 }
}

/** Avisa en pantalla de lo que han hecho los camellos mientras tanto */
function reportDealers(events: DealerEvent[]): void {
  if (events.length === 0) return
  const stolen = events.reduce((a, e) => a + e.amount, 0)
  const cuts = events.filter((e) => e.kind === 'cut').length
  useInventoryStore
    .getState()
    .setNotice(`Tus camellos te han quitado $${stolen} sucios${cuts > 0 ? ` y han adulterado el producto ${cuts} vez/veces (¡más Heat!)` : ''}. Mira el informe en el HQ.`)
}

export const storageCap = (level: number): number => STORAGE_CAPACITY[level - 1]
export const isNearHq = (hq: Hq | null, pos: LatLng | null): boolean =>
  !!hq && !!pos && haversine(hq, pos) <= INTERACTION_RADIUS_M

export const useBaseStore = create<BaseState>()(
  persist(
    (set, get) => ({
      hq: null,
      hqLevel: 1,
      labLevel: 1,
      storageLevel: 1,
      storage: {},
      job: null,
      dealers: [],
      dealerLog: [],
      businesses: [],
      visited: {},
      suppliers: {},
      carriers: [],
      reputation: 0,
      dealersAt: Date.now(),
      launderAt: Date.now(),
      adAt: 0,
      favors: FAVORS_START,

      placeHq: (pos) => {
        const { hq } = get()
        const now = Date.now()
        if (hq && now - hq.movedAt < HQ_MOVE_COOLDOWN_MS) {
          const days = Math.ceil((HQ_MOVE_COOLDOWN_MS - (now - hq.movedAt)) / 86_400_000)
          return fail(`Podrás mover el HQ gratis en ${days} día(s).`)
        }
        set({ hq: { lat: pos.lat, lng: pos.lng, movedAt: now } })
        return done('Cuartel General colocado.')
      },

      startJob: (recipeId, batches) => {
        get().sync()
        const s = get()
        const r = RECIPES[recipeId]
        if (s.labLevel < r.minLab) return fail('Tu laboratorio es demasiado básico para esto.')
        if (s.reputation < r.minRep) return fail(`Necesitas ${r.minRep} de reputación.`)
        if (s.job && s.job.recipe !== recipeId) return fail('El laboratorio ya está cocinando otra cosa.')
        const entries = Object.entries(r.inputs) as [ItemId, number][]
        const max = Math.min(...entries.map(([item, n]) => Math.floor((s.storage[item] ?? 0) / n)))
        const n = Math.min(batches, max)
        if (n < 1) return fail('Faltan precursores en el almacén.')
        const storage = { ...s.storage }
        for (const [item, per] of entries) storage[item] = (storage[item] ?? 0) - per * n
        const job: Job = s.job
          ? { ...s.job, remaining: s.job.remaining + n }
          : { recipe: recipeId, remaining: n, nextAt: Date.now() + batchDurationMs(recipeId, s.labLevel) }
        set({ storage, job })
        return done(`Cocinando ${n} lote(s).`)
      },

      hireDealer: (poi) => {
        const s = get()
        const inv = useInventoryStore.getState()
        if (poi.kind !== 'park' && poi.kind !== 'nightlife') return fail('Los camellos solo trabajan parques y bares.')
        if (s.dealers.some((d) => d.poiId === poi.id)) return fail('Ya hay un camello ahí.')
        const here = usePlayerStore.getState().position
        if (!here || haversine(here, poi) > INTERACTION_RADIUS_M) return fail('Tienes que estar allí en persona para contratarlo.')
        if (s.dealers.length >= DEALER_SLOTS[s.hqLevel - 1]) return fail('No tienes más huecos. Mejora el HQ.')
        if (inv.cleanCash < DEALER_HIRE_COST) return fail(`Contratar cuesta $${DEALER_HIRE_COST} limpios.`)
        const warn = okToSpend(s, inv.cleanCash, DEALER_HIRE_COST, () => get().hireDealer(poi))
        if (warn) return warn
        useInventoryStore.setState({ cleanCash: inv.cleanCash - DEALER_HIRE_COST })
        set({
          dealers: [...s.dealers, newDealer(poi)],
          dealersAt: s.dealers.length === 0 ? Date.now() : s.dealersAt,
        })
        return done('Camello contratado.')
      },
      fireDealer: (id) => {
        const s = get()
        if (!s.dealers.some((d) => d.id === id)) return fail('No existe ese camello.')
        const refund = Math.floor(DEALER_HIRE_COST * REFUND_SHARE)
        const inv = useInventoryStore.getState()
        useInventoryStore.setState({ cleanCash: inv.cleanCash + refund })
        set({ dealers: s.dealers.filter((d) => d.id !== id) })
        return done(`Camello despedido. Te devuelve ${refund} limpios.`)
      },

      bonusDealer: (id) => {
        const s = get()
        const inv = useInventoryStore.getState()
        const d = s.dealers.find((x) => x.id === id)
        if (!d) return fail('No existe ese camello.')
        if (honestyOf(d) >= 100) return fail('Ya es de total confianza.')
        if (inv.dirtyCash < DEALER_BONUS_COST) return fail(`La prima cuesta ${DEALER_BONUS_COST} sucios.`)
        useInventoryStore.setState({ dirtyCash: inv.dirtyCash - DEALER_BONUS_COST })
        set({ dealers: s.dealers.map((x) => (x.id === id ? { ...x, honesty: Math.min(100, honestyOf(x) + DEALER_BONUS_HONESTY) } : x)) })
        return done('Prima pagada: ahora te lo piensa dos veces antes de rascar.')
      },

      buyBusiness: (poi) => {
        const s = get()
        const inv = useInventoryStore.getState()
        if (poi.kind !== 'cover') return fail('Eso no es un negocio tapadera.')
        if (s.businesses.some((b) => b.poiId === poi.id)) return fail('Ya es tuyo.')
        const cost = businessCost(s.businesses.length)
        if (inv.cleanCash < cost) return fail(`Cuesta $${cost} limpios.`)
        useInventoryStore.setState({ cleanCash: inv.cleanCash - cost })
        set({
          businesses: [...s.businesses, { poiId: poi.id, name: poi.name }],
          launderAt: s.businesses.length === 0 ? Date.now() : s.launderAt,
        })
        return done('Negocio comprado. Empieza a blanquear solo.')
      },

      upgrade: (kind) => {
        const s = get()
        const inv = useInventoryStore.getState()
        const level = levelOf(s, kind)
        if (level >= MAX_LEVEL) return fail('Ya está al máximo.')
        if (kind !== 'hq' && level >= s.hqLevel) return fail('Mejora antes el Cuartel General.')
        const cost = UPGRADE_INFO[kind].costs[level]
        if (inv.cleanCash < cost) return fail(`Cuesta ${cost} limpios.`)
        const warn = okToSpend(s, inv.cleanCash, cost, () => get().upgrade(kind))
        if (warn) return warn
        useInventoryStore.setState({ cleanCash: inv.cleanCash - cost })
        set(
          kind === 'hq'
            ? { hqLevel: level + 1 }
            : kind === 'lab'
              ? { labLevel: level + 1 }
              : { storageLevel: level + 1 },
        )
        return done(`${UPGRADE_INFO[kind].label} al nivel ${level + 1}.`)
      },

      establishContact: (poi) => {
        const s = get()
        if (poi.kind !== 'warehouse' && poi.kind !== 'pharmacy') return fail('Ahí no hay nadie que te suministre.')
        if (s.suppliers[poi.id]) return fail('Ya es tu proveedor.')
        const pos = usePlayerStore.getState().position
        if (!pos || haversine(pos, poi) > INTERACTION_RADIUS_M) return fail('Tienes que estar allí en persona.')
        const { id, kind, name, lat, lng } = poi
        set({ suppliers: { ...s.suppliers, [id]: { poi: { id, kind, name, lat, lng }, level: 1, order: null } } })
        return done('Contacto establecido. Ya puedes pedirle mercancía desde el HQ.')
      },

      grantFavors: (n) => set((s) => ({ favors: s.favors + n })),

      skipOrder: (poiId) => {
        get().sync()
        const s = get()
        const now = Date.now()
        const sup = s.suppliers[poiId]
        if (!sup?.order || sup.order.readyAt <= now) return fail('No hay nada que adelantar.')
        const cost = favorCost(sup.order.readyAt - now)
        if (s.favors < cost) return fail(`Necesitas ${cost} favores.`)
        set({ favors: s.favors - cost, suppliers: { ...s.suppliers, [poiId]: { ...sup, order: { ...sup.order, readyAt: now } } } })
        get().sync()
        return done(`Pedido listo al instante (-${cost} favores).`)
      },

      skipTrip: (carrierId) => {
        get().sync()
        const s = get()
        const now = Date.now()
        const c = s.carriers.find((x) => x.id === carrierId)
        if (!c?.trip || c.trip.arriveAt <= now) return fail('No hay ningún viaje que acelerar.')
        const cost = favorCost(c.trip.arriveAt - now)
        if (s.favors < cost) return fail(`Necesitas ${cost} favores.`)
        set({ favors: s.favors - cost, carriers: s.carriers.map((x) => (x.id === carrierId && x.trip ? { ...x, trip: { ...x.trip, arriveAt: now } } : x)) })
        get().sync()
        return done(`Transportista llegado al instante (-${cost} favores).`)
      },

      skipBatch: () => {
        get().sync()
        const s = get()
        const now = Date.now()
        if (!s.job || s.job.nextAt <= now) return fail('No hay ningún lote en marcha.')
        const cost = favorCost(s.job.nextAt - now)
        if (s.favors < cost) return fail(`Necesitas ${cost} favores.`)
        set({ favors: s.favors - cost, job: { ...s.job, nextAt: now } })
        get().sync()
        return done(`Lote terminado al instante (-${cost} favores).`)
      },

      calmHeat: () => {
        const s = get()
        const inv = useInventoryStore.getState()
        if (inv.heat <= 0) return fail('La policía no te busca.')
        if (s.favors < CALM_HEAT_COST) return fail(`Necesitas ${CALM_HEAT_COST} favores.`)
        useInventoryStore.setState({ heat: 0 })
        set({ favors: s.favors - CALM_HEAT_COST })
        return done(`Un amigo en comisaría despista a la poli (-${CALM_HEAT_COST} favores).`)
      },

      claimAdReward: () => {
        const inv = useInventoryStore.getState()
        const now = Date.now()
        if (!canOfferAd(inv.dirtyCash, inv.cleanCash, get().adAt, now)) return fail('Ahora no hay recompensa disponible.')
        useInventoryStore.setState({ dirtyCash: inv.dirtyCash + AD_RESCUE_REWARD })
        set({ adAt: now })
        return done(`Patrocinador generoso: +${AD_RESCUE_REWARD} sucios.`)
      },

      makeDirty: (cleanAmount) => {
        const s = get()
        const inv = useInventoryStore.getState()
        if (cleanAmount < 1) return fail('Indica una cantidad.')
        if (inv.cleanCash < cleanAmount) return fail(`No tienes ${cleanAmount} limpios.`)
        const warn = okToSpend(s, inv.cleanCash, cleanAmount, () => get().makeDirty(cleanAmount))
        if (warn) return warn
        const dirty = dirtyFromClean(cleanAmount)
        useInventoryStore.setState({ cleanCash: inv.cleanCash - cleanAmount, dirtyCash: inv.dirtyCash + dirty })
        return done(`Ensuciados ${cleanAmount} limpios: te dan ${dirty} sucios.`)
      },

      orderSupply: (poiId, item, qty) => {
        get().sync()
        const s = get()
        const inv = useInventoryStore.getState()
        const supplier = s.suppliers[poiId]
        if (!supplier) return fail('Primero hay que ir en persona a establecer contacto.')
        if (!s.hq) return fail('Coloca antes tu Cuartel General: allí llega la mercancía.')
        if (s.carriers.length === 0) return fail('Contrata un transportista en el HQ: sin él no llega nada.')
        const free = storageCap(s.storageLevel) - carried(s.storage) - pending(s.suppliers, s.carriers)
        const now = Date.now()
        const plan = planOrder(supplier, item, qty, free, inv.dirtyCash, now)
        if (!plan.ok) return fail(plan.reason)
        useInventoryStore.setState({ dirtyCash: inv.dirtyCash - plan.cost })
        set({ suppliers: { ...s.suppliers, [poiId]: { ...supplier, order: plan.order } } })
        return done(`Pedido: ${plan.qty} × ${ITEMS[item].label} por ${plan.cost}. Lo preparan y un transportista lo recoge.`)
      },

      upgradeSupplier: (poiId) => {
        const s = get()
        const inv = useInventoryStore.getState()
        const supplier = s.suppliers[poiId]
        if (!supplier) return fail('No es tu proveedor.')
        const pos = usePlayerStore.getState().position
        const remote = !pos || haversine(pos, supplier.poi) > INTERACTION_RADIUS_M
        const cost = supplierUpgradeCost(supplier.level, remote)
        if (cost === null) return fail('Ya está al máximo.')
        if (inv.cleanCash < cost) return fail(`Cuesta ${cost} limpios${remote ? ' por teléfono' : ''}.`)
        const warn = okToSpend(s, inv.cleanCash, cost, () => get().upgradeSupplier(poiId))
        if (warn) return warn
        useInventoryStore.setState({ cleanCash: inv.cleanCash - cost })
        set({ suppliers: { ...s.suppliers, [poiId]: { ...supplier, level: supplier.level + 1 } } })
        return done(`Proveedor al nivel ${supplier.level + 1}${remote ? ' (negociado por teléfono)' : ''}.`)
      },

      hireCarrier: () => {
        const s = get()
        const inv = useInventoryStore.getState()
        if (s.carriers.length >= CARRIER_SLOTS[s.hqLevel - 1]) return fail('No tienes más huecos. Mejora el HQ.')
        if (inv.cleanCash < CARRIER_HIRE_COST) return fail(`Contratar cuesta ${CARRIER_HIRE_COST} limpios.`)
        const warn = okToSpend(s, inv.cleanCash, CARRIER_HIRE_COST, () => get().hireCarrier())
        if (warn) return warn
        useInventoryStore.setState({ cleanCash: inv.cleanCash - CARRIER_HIRE_COST })
        set({ carriers: [...s.carriers, newCarrier(`t${Date.now()}`, Date.now())] })
        return done('Transportista contratado.')
      },

      upgradeCarrier: (id) => {
        const s = get()
        const inv = useInventoryStore.getState()
        const c = s.carriers.find((x) => x.id === id)
        if (!c) return fail('No existe ese transportista.')
        if (c.level >= SUPPLY_MAX_LEVEL) return fail('Ya está al máximo.')
        const cost = CARRIER_UPGRADE_COSTS[c.level]
        if (inv.cleanCash < cost) return fail(`Cuesta ${cost} limpios.`)
        const warn = okToSpend(s, inv.cleanCash, cost, () => get().upgradeCarrier(id))
        if (warn) return warn
        useInventoryStore.setState({ cleanCash: inv.cleanCash - cost })
        set({ carriers: s.carriers.map((x) => (x.id === id ? { ...x, level: x.level + 1 } : x)) })
        return done(`Transportista al nivel ${c.level + 1}.`)
      },

      markVisited: (pois) => {
        const { visited } = get()
        const fresh = pois.filter((p) => !visited[p.id])
        if (fresh.length === 0) return
        const next = { ...visited }
        for (const p of fresh) next[p.id] = { id: p.id, kind: p.kind, name: p.name, lat: p.lat, lng: p.lng }
        set({ visited: next })
      },

      seizeStock: (share) => {
        const s = get()
        const next: Inventory = {}
        let seized = 0
        for (const [item, n] of Object.entries(s.storage) as [ItemId, number][]) {
          const take = Math.floor((n ?? 0) * share)
          seized += take
          next[item] = (n ?? 0) - take
        }
        if (seized > 0) set({ storage: next })
        return seized
      },

      sync: () => {
        const s = get()
        const inv = useInventoryStore.getState()
        const before: IdleState = {
          storage: s.storage,
          storageCap: storageCap(s.storageLevel),
          labLevel: s.labLevel,
          job: s.job,
          dealers: s.dealers,
          businesses: s.businesses,
          dirtyCash: inv.dirtyCash,
          cleanCash: inv.cleanCash,
          dealersAt: s.dealersAt,
          launderAt: s.launderAt,
        }
        const after = syncIdle(before, Date.now())
        reportDealers(after.events)
        const supply = advanceSupply(
          { suppliers: s.suppliers, carriers: s.carriers, storage: after.storage, storageCap: storageCap(s.storageLevel) },
          Date.now(),
        )
        set({
          storage: supply.storage,
          suppliers: supply.suppliers,
          carriers: supply.carriers,
          job: after.job,
          dealers: after.dealers,
          dealerLog: after.events.length > 0 ? [...after.events.slice().reverse(), ...s.dealerLog].slice(0, DEALER_LOG_MAX) : s.dealerLog,
          reputation: Math.max(0, s.reputation + after.repDelta),
          dealersAt: after.dealersAt,
          launderAt: after.launderAt,
        })
        if (supply.delivered > 0) useInventoryStore.getState().setNotice(`Llegó un envío al HQ: ${supply.delivered} unidades.`)
        if (after.heatDelta > 0) useInventoryStore.setState({ heat: Math.min(HEAT_MAX, inv.heat + after.heatDelta) })
        if (after.dirtyCash !== inv.dirtyCash || after.cleanCash !== inv.cleanCash)
          useInventoryStore.setState({ dirtyCash: after.dirtyCash, cleanCash: after.cleanCash })
      },
    }),
    {
      name: 'cartelgo:base',
      version: 1,
      storage: createJSONStorage(() => idbStorage),
    },
  ),
)
