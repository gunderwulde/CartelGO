import { describe, expect, it } from 'vitest'
import { CARRIER_LEVELS, SUPPLIER_LEVELS } from '../data/supply'
import {
  advanceSupply,
  pending,
  planOrder,
  supplierUpgradeCost,
  type Carrier,
  type Supplier,
  type SupplyState,
} from './supplyEngine'

const T0 = 1_000_000
const MIN = 60_000

const supplier = (id: string, kind: 'warehouse' | 'pharmacy' = 'warehouse', level = 1): Supplier => ({
  poi: { id, kind, name: id, lat: 0, lng: 0 },
  level,
  order: null,
})
const carrier = (id: string, level = 1, freeAt = T0): Carrier => ({ id, level, trip: null, freeAt })
const state = (over: Partial<SupplyState>): SupplyState => ({
  suppliers: {},
  carriers: [],
  storage: {},
  storageCap: 100,
  ...over,
})

describe('planOrder', () => {
  it('limita por nivel del punto, espacio y dinero', () => {
    const s = supplier('a')
    const r = planOrder(s, 'quimicos', 999, 500, 100_000, T0)
    expect(r.ok && r.qty).toBe(SUPPLIER_LEVELS[0].maxQty)
    const space = planOrder(s, 'quimicos', 999, 5, 100_000, T0)
    expect(space.ok && space.qty).toBe(5)
    const poor = planOrder(s, 'fertilizante', 999, 500, 20, T0) // 6 × 0,6 ≈ 4 $/ud
    expect(poor.ok && poor.qty).toBeLessThanOrEqual(5)
  })

  it('el almacén clandestino es más barato que la farmacia', () => {
    const w = planOrder(supplier('w', 'warehouse'), 'quimicos', 10, 100, 1000, T0)
    const p = planOrder(supplier('p', 'pharmacy'), 'quimicos', 10, 100, 1000, T0)
    expect(w.ok && p.ok && w.cost < p.cost).toBe(true)
  })

  it('la farmacia solo vende químicos y no admite dos pedidos a la vez', () => {
    expect(planOrder(supplier('p', 'pharmacy'), 'baterias', 10, 100, 1000, T0).ok).toBe(false)
    const busy = { ...supplier('w'), order: { item: 'quimicos' as const, qty: 5, readyAt: T0 } }
    expect(planOrder(busy, 'quimicos', 5, 100, 1000, T0).ok).toBe(false)
  })

  it('el pedido queda listo tras el tiempo de preparación del nivel', () => {
    const r = planOrder(supplier('a', 'warehouse', 3), 'quimicos', 10, 100, 1000, T0)
    expect(r.ok && r.order.readyAt).toBe(T0 + SUPPLIER_LEVELS[2].prepMs)
  })
})

describe('supplierUpgradeCost', () => {
  it('por teléfono cuesta el triple y en el máximo no hay mejora', () => {
    expect(supplierUpgradeCost(1, false)).toBe(150)
    expect(supplierUpgradeCost(1, true)).toBe(450)
    expect(supplierUpgradeCost(3, false)).toBeNull()
  })
})

describe('advanceSupply', () => {
  const ordered = (qty: number, readyAt: number): Supplier => ({
    ...supplier('a'),
    order: { item: 'quimicos', qty, readyAt },
  })

  it('sin transportistas no llega nada', () => {
    const r = advanceSupply(state({ suppliers: { a: ordered(10, T0) } }), T0 + 999 * MIN)
    expect(r.delivered).toBe(0)
    expect(r.suppliers.a.order?.qty).toBe(10)
  })

  it('no se recoge antes de que esté preparado', () => {
    const r = advanceSupply(state({ suppliers: { a: ordered(10, T0 + 6 * MIN) }, carriers: [carrier('c')] }), T0 + 5 * MIN)
    expect(r.carriers[0].trip).toBeNull()
  })

  it('el transportista recoge y entrega tras el viaje', () => {
    const readyAt = T0 + 6 * MIN
    const base = state({ suppliers: { a: ordered(10, readyAt) }, carriers: [carrier('c')] })
    const mid = advanceSupply(base, readyAt + 1)
    expect(mid.carriers[0].trip?.qty).toBe(10)
    expect(mid.storage.quimicos ?? 0).toBe(0)
    const end = advanceSupply(base, readyAt + CARRIER_LEVELS[0].tripMs)
    expect(end.storage.quimicos).toBe(10)
    expect(end.delivered).toBe(10)
    expect(end.suppliers.a.order).toBeNull()
    expect(end.carriers[0].trip).toBeNull()
  })

  it('un pedido mayor que la capacidad del viaje necesita varios viajes', () => {
    const readyAt = T0
    const cap = CARRIER_LEVELS[0].capacity
    const base = state({ suppliers: { a: ordered(cap + 5, readyAt) }, carriers: [carrier('c')] })
    const first = advanceSupply(base, readyAt + CARRIER_LEVELS[0].tripMs)
    expect(first.storage.quimicos).toBe(cap)
    const done = advanceSupply(base, readyAt + 2 * CARRIER_LEVELS[0].tripMs)
    expect(done.storage.quimicos).toBe(cap + 5)
  })

  it('el resultado tras una ausencia larga es el mismo que ir poniéndolo al día', () => {
    const base = state({ suppliers: { a: ordered(60, T0) }, carriers: [carrier('c'), carrier('d')], storageCap: 500 })
    const far = T0 + 60 * MIN
    const direct = advanceSupply(base, far)
    let stepped = base
    for (let t = T0; t <= far; t += MIN) stepped = advanceSupply(stepped, t)
    expect(direct.storage).toEqual(stepped.storage)
    expect(direct.delivered).toBe(60)
  })

  it('con el almacén lleno lo que no cabe espera y entra cuando hay sitio', () => {
    const base = state({ suppliers: { a: ordered(10, T0) }, carriers: [carrier('c')], storage: { fertilizante: 98 }, storageCap: 100 })
    const t = T0 + CARRIER_LEVELS[0].tripMs
    const first = advanceSupply(base, t)
    expect(first.storage.quimicos).toBe(2)
    expect(first.carriers[0].trip?.qty).toBe(8)
    const freed = advanceSupply({ ...first, storage: { quimicos: 2 } }, t + 5000)
    expect(freed.storage.quimicos).toBe(10)
    expect(freed.carriers[0].trip).toBeNull()
  })

  it('dos transportistas atienden dos pedidos a la vez', () => {
    const base = state({
      suppliers: { a: ordered(10, T0), b: { ...supplier('b'), order: { item: 'quimicos', qty: 10, readyAt: T0 } } },
      carriers: [carrier('c'), carrier('d')],
    })
    const r = advanceSupply(base, T0 + 1)
    expect(r.carriers.every((c) => c.trip !== null)).toBe(true)
  })

  it('un transportista mejor viaja más rápido', () => {
    const base = state({ suppliers: { a: ordered(10, T0) }, carriers: [carrier('c', 3)] })
    expect(advanceSupply(base, T0 + CARRIER_LEVELS[2].tripMs).storage.quimicos).toBe(10)
  })
})

describe('pending', () => {
  it('cuenta pedidos y viajes en curso', () => {
    const s = { ...supplier('a'), order: { item: 'quimicos' as const, qty: 7, readyAt: T0 } }
    const c = { ...carrier('c'), trip: { supplierId: 'x', item: 'quimicos' as const, qty: 3, arriveAt: T0 } }
    expect(pending({ a: s }, [c])).toBe(10)
  })
})
