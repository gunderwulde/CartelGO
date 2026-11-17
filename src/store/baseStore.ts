import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { del, get as idbGet, set as idbSet } from 'idb-keyval'
import {
  BACKPACK_CAPACITY,
  DEALER_HIRE_COST,
  DEALER_SLOTS,
  HQ_MOVE_COOLDOWN_MS,
  MAX_LEVEL,
  RECIPES,
  REP_PER_UNIT,
  STORAGE_CAPACITY,
  UPGRADE_INFO,
  businessCost,
  type RecipeId,
  type UpgradeKind,
} from '../data/buildings'
import type { ItemId } from '../data/items'
import type { LatLng } from '../types'
import type { Poi } from '../types/poi'
import { syncIdle, batchDurationMs, type Business, type Dealer, type IdleState, type Job } from '../services/idleEngine'
import { carried, type Inventory } from '../services/tradeEngine'
import { haversine, INTERACTION_RADIUS_M } from '../services/geoService'
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

export type ActionResult = { ok: true; message: string } | { ok: false; reason: string }
const fail = (reason: string): ActionResult => ({ ok: false, reason })
const done = (message: string): ActionResult => ({ ok: true, message })

export type VisitedPoi = Pick<Poi, 'id' | 'kind' | 'name' | 'lat' | 'lng'>

interface BaseState {
  /** Coordenadas exactas del HQ: SOLO en local. Nunca enviar (AGENTS §3) */
  hq: Hq | null
  hqLevel: number
  labLevel: number
  storageLevel: number
  backpackLevel: number
  storage: Inventory
  job: Job | null
  dealers: Dealer[]
  businesses: Business[]
  visited: Record<string, VisitedPoi>
  reputation: number
  dealersAt: number
  launderAt: number

  placeHq: (pos: LatLng) => ActionResult
  transfer: (mode: 'deposit' | 'withdraw', item: ItemId, qty: number) => ActionResult
  startJob: (recipe: RecipeId, batches: number) => ActionResult
  hireDealer: (poi: VisitedPoi) => ActionResult
  fireDealer: (id: string) => void
  buyBusiness: (poi: VisitedPoi) => ActionResult
  upgrade: (kind: UpgradeKind) => ActionResult
  markVisited: (pois: Poi[]) => void
  addSaleReputation: (item: ItemId, qty: number) => void
  /** Avanza el idle hasta ahora (producción, camellos y blanqueo) */
  sync: () => void
}

const levelOf = (s: BaseState, kind: UpgradeKind): number =>
  ({ hq: s.hqLevel, lab: s.labLevel, storage: s.storageLevel, backpack: s.backpackLevel })[kind]

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
      backpackLevel: 1,
      storage: {},
      job: null,
      dealers: [],
      businesses: [],
      visited: {},
      reputation: 0,
      dealersAt: Date.now(),
      launderAt: Date.now(),

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

      transfer: (mode, item, qty) => {
        const s = get()
        if (!isNearHq(s.hq, usePlayerStore.getState().position)) return fail('Tienes que estar junto al HQ.')
        const inv = useInventoryStore.getState()
        const from = mode === 'deposit' ? inv.inventory : s.storage
        const toUsed = carried(mode === 'deposit' ? s.storage : inv.inventory)
        const toCap = mode === 'deposit' ? storageCap(s.storageLevel) : inv.capacity
        const n = Math.min(qty, from[item] ?? 0, toCap - toUsed)
        if (n < 1) return fail((from[item] ?? 0) < 1 ? 'No hay nada que mover.' : 'No hay espacio.')
        const take = (b: Inventory): Inventory => ({ ...b, [item]: (b[item] ?? 0) - n })
        const give = (b: Inventory): Inventory => ({ ...b, [item]: (b[item] ?? 0) + n })
        if (mode === 'deposit') {
          useInventoryStore.setState({ inventory: take(inv.inventory) })
          set({ storage: give(s.storage) })
        } else {
          set({ storage: take(s.storage) })
          useInventoryStore.setState({ inventory: give(inv.inventory) })
        }
        return done(`${n} movidos.`)
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
        if (s.dealers.length >= DEALER_SLOTS[s.hqLevel - 1]) return fail('No tienes más huecos. Mejora el HQ.')
        if (inv.cleanCash < DEALER_HIRE_COST) return fail(`Contratar cuesta $${DEALER_HIRE_COST} limpios.`)
        useInventoryStore.setState({ cleanCash: inv.cleanCash - DEALER_HIRE_COST })
        set({
          dealers: [...s.dealers, { id: `d${Date.now()}`, poiId: poi.id, kind: poi.kind, name: poi.name }],
          dealersAt: s.dealers.length === 0 ? Date.now() : s.dealersAt,
        })
        return done('Camello contratado.')
      },
      fireDealer: (id) => set((s) => ({ dealers: s.dealers.filter((d) => d.id !== id) })),

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
        if (inv.cleanCash < cost) return fail(`Cuesta $${cost} limpios.`)
        useInventoryStore.setState({ cleanCash: inv.cleanCash - cost })
        if (kind === 'backpack') useInventoryStore.setState({ capacity: BACKPACK_CAPACITY[level] })
        set(
          kind === 'hq'
            ? { hqLevel: level + 1 }
            : kind === 'lab'
              ? { labLevel: level + 1 }
              : kind === 'storage'
                ? { storageLevel: level + 1 }
                : { backpackLevel: level + 1 },
        )
        return done(`${UPGRADE_INFO[kind].label} al nivel ${level + 1}.`)
      },

      markVisited: (pois) => {
        const { visited } = get()
        const fresh = pois.filter((p) => !visited[p.id])
        if (fresh.length === 0) return
        const next = { ...visited }
        for (const p of fresh) next[p.id] = { id: p.id, kind: p.kind, name: p.name, lat: p.lat, lng: p.lng }
        set({ visited: next })
      },

      addSaleReputation: (item, qty) => {
        const gain = REP_PER_UNIT[item] * qty
        if (gain > 0) set((s) => ({ reputation: s.reputation + gain }))
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
        set({ storage: after.storage, job: after.job, dealersAt: after.dealersAt, launderAt: after.launderAt })
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
