import { describe, expect, it } from 'vitest'
import { buy, dailyRemaining, sell, unitPrice, type TradeState } from './tradeEngine'
import { isBusted, nextHeat } from './heatEngine'

const day = new Date(2026, 0, 10, 12, 0)
const night = new Date(2026, 0, 10, 22, 0)
const early = new Date(2026, 0, 10, 3, 0)

const base = (over: Partial<TradeState> = {}): TradeState => ({
  inventory: {},
  dirtyCash: 100,
  capacity: 30,
  limits: { day: '2026-01-10', bought: {} },
  ...over,
})

describe('precios', () => {
  it('discoteca paga x2 de 20:00 a 04:00', () => {
    expect(unitPrice('nightlife', 'hierba', day)).toBe(30)
    expect(unitPrice('nightlife', 'hierba', night)).toBe(60)
    expect(unitPrice('nightlife', 'hierba', early)).toBe(60)
  })
  it('el almacén es más barato que la farmacia', () => {
    expect(unitPrice('warehouse', 'quimicos', day)).toBeLessThan(unitPrice('pharmacy', 'quimicos', day))
  })
})

describe('compra', () => {
  const wh = { id: 'way/1', kind: 'warehouse' as const }
  it('descuenta dinero y suma inventario', () => {
    const r = buy(base(), wh, 'quimicos', 5, day)
    expect(r.ok && r.state.dirtyCash).toBe(100 - 5 * 6)
    expect(r.ok && r.state.inventory.quimicos).toBe(5)
  })
  it('limita por mochila', () => {
    const r = buy(base({ capacity: 3, dirtyCash: 1000 }), wh, 'quimicos', 10, day)
    expect(r.ok && r.qty).toBe(3)
  })
  it('limita por dinero', () => {
    const r = buy(base({ dirtyCash: 13 }), wh, 'quimicos', 10, day)
    expect(r.ok && r.qty).toBe(2)
  })
  it('falla con mochila llena', () => {
    const r = buy(base({ inventory: { hierba: 30 } }), wh, 'quimicos', 1, day)
    expect(r).toEqual({ ok: false, reason: 'Mochila llena.' })
  })
  it('la farmacia tiene límite diario y se reinicia al día siguiente', () => {
    const ph = { id: 'node/9', kind: 'pharmacy' as const }
    let s = base({ dirtyCash: 1000 })
    const r1 = buy(s, ph, 'quimicos', 20, day)
    expect(r1.ok && r1.qty).toBe(8)
    if (r1.ok) s = r1.state
    expect(buy(s, ph, 'quimicos', 1, day).ok).toBe(false)
    const tomorrow = new Date(2026, 0, 11, 9, 0)
    expect(dailyRemaining(ph, s.limits, tomorrow)).toBe(8)
    expect(buy(s, ph, 'quimicos', 1, tomorrow).ok).toBe(true)
  })
  it('no vende lo que el lugar no ofrece', () => {
    expect(buy(base(), wh, 'hierba', 1, day).ok).toBe(false)
  })
})

describe('venta', () => {
  const park = { id: 'way/2', kind: 'park' as const }
  it('suma dinero y resta inventario', () => {
    const r = sell(base({ inventory: { hierba: 4 } }), park, 'hierba', 3, day)
    expect(r.ok && r.state.dirtyCash).toBe(100 + 90)
    expect(r.ok && r.state.inventory.hierba).toBe(1)
  })
  it('solo vende lo que lleva', () => {
    const r = sell(base({ inventory: { hierba: 2 } }), park, 'hierba', 9, day)
    expect(r.ok && r.qty).toBe(2)
    expect(sell(base(), park, 'hierba', 1, day).ok).toBe(false)
  })
})

describe('heat', () => {
  it('sube en zona caliente y baja fuera', () => {
    expect(nextHeat(0, true, 10)).toBe(20)
    expect(nextHeat(20, false, 10)).toBe(15)
  })
  it('se queda entre 0 y 100', () => {
    expect(nextHeat(95, true, 60)).toBe(100)
    expect(nextHeat(1, false, 60)).toBe(0)
    expect(isBusted(100)).toBe(true)
    expect(isBusted(99)).toBe(false)
  })
})

import { honestyOf, rollHonesty, syncIdle, type IdleState } from './idleEngine'

const T0 = 1_000_000_000_000
const idle = (over: Partial<IdleState> = {}): IdleState => ({
  storage: {},
  storageCap: 100,
  labLevel: 1,
  job: null,
  dealers: [],
  businesses: [],
  dirtyCash: 0,
  cleanCash: 0,
  dealersAt: T0,
  launderAt: T0,
  ...over,
})

describe('laboratorio (offline)', () => {
  it('produce los lotes que caben en el tiempo transcurrido', () => {
    const s = idle({ job: { recipe: 'hierba', remaining: 5, nextAt: T0 + 20_000 } })
    const r = syncIdle(s, T0 + 70_000) // lotes a 20, 40 y 60 s
    expect(r.storage.hierba).toBe(3)
    expect(r.job?.remaining).toBe(2)
  })
  it('termina el trabajo y lo borra', () => {
    const s = idle({ job: { recipe: 'hierba', remaining: 2, nextAt: T0 + 20_000 } })
    const r = syncIdle(s, T0 + 3_600_000)
    expect(r.storage.hierba).toBe(2)
    expect(r.job).toBeNull()
  })
  it('el almacén lleno detiene la producción sin perder lotes', () => {
    const s = idle({ storageCap: 2, storage: { hierba: 2 }, job: { recipe: 'hierba', remaining: 3, nextAt: T0 + 1000 } })
    const r = syncIdle(s, T0 + 3_600_000)
    expect(r.storage.hierba).toBe(2)
    expect(r.job?.remaining).toBe(3)
  })
  it('un laboratorio mejor es más rápido', () => {
    const s = idle({ labLevel: 3, job: { recipe: 'hierba', remaining: 9, nextAt: T0 + 10_000 } })
    expect(syncIdle(s, T0 + 30_000).storage.hierba).toBe(3) // 10 s por lote
  })
})

describe('camellos (offline)', () => {
  const dealer = { id: 'd1', poiId: 'way/1', kind: 'park' as const, name: null, honesty: 100 }
  it('venden lo más caro primero y cobran su parte', () => {
    const s = idle({ dealers: [dealer], storage: { hierba: 5, cristal: 1 } })
    const r = syncIdle(s, T0 + 60_000) // 2 ticks
    expect(r.storage).toEqual({ hierba: 4, cristal: 0 })
    expect(r.dirtyCash).toBe(Math.round(90 * 0.8) + Math.round(30 * 0.8))
  })
  it('no venden si no hay existencias', () => {
    const r = syncIdle(idle({ dealers: [dealer] }), T0 + 600_000)
    expect(r.dirtyCash).toBe(0)
  })
  it('el progreso offline se limita a 8 h', () => {
    const s = idle({ dealers: [dealer], storage: { hierba: 100000 } })
    const r = syncIdle(s, T0 + 100 * 3_600_000)
    expect(r.dirtyCash).toBe(960 * Math.round(30 * 0.8))
  })
})

describe('camellos: robo y adulteración', () => {
  const shady = (honesty: number) => ({ id: 'd2', poiId: 'way/2', kind: 'park' as const, name: 'Parque Sol', honesty })
  const run = (honesty: number) =>
    syncIdle(idle({ dealers: [shady(honesty)], storage: { hierba: 100000 } }), T0 + 8 * 3_600_000)

  it('un camello 100 % fiable nunca roba ni adultera', () => {
    const r = run(100)
    expect(r.events).toHaveLength(0)
    expect(r.dealers[0].stolen ?? 0).toBe(0)
    expect(r.heatDelta).toBe(0)
  })

  it('uno poco fiable roba y adultera, y queda en el libro de cuentas', () => {
    const r = run(0)
    const d = r.dealers[0]
    expect(d.sold).toBe(960)
    expect(r.events.some((e) => e.kind === 'theft')).toBe(true)
    expect(r.events.some((e) => e.kind === 'cut')).toBe(true)
    expect(d.cutUnits ?? 0).toBeGreaterThan(0)
    expect(d.stolen ?? 0).toBeGreaterThan(0)
    // lo que cobras + lo que te quitó = lo que habrías cobrado
    expect((d.earned ?? 0) + (d.stolen ?? 0)).toBe(960 * Math.round(30 * 0.8))
    expect(r.dirtyCash).toBe(d.earned)
  })

  it('las adulteraciones suben el Heat y bajan la reputación', () => {
    const r = run(0)
    const cuts = r.events.filter((e) => e.kind === 'cut').length
    expect(cuts).toBeGreaterThan(0)
    expect(r.heatDelta).toBeGreaterThan(0)
  })

  it('cuanto más fiable, menos se queda', () => {
    expect(run(20).dealers[0].stolen ?? 0).toBeGreaterThan(run(80).dealers[0].stolen ?? 0)
  })

  it('es determinista: el mismo tramo de tiempo da siempre lo mismo', () => {
    expect(run(30).dealers[0].stolen).toBe(run(30).dealers[0].stolen)
    expect(run(30).events).toEqual(run(30).events)
  })

  it('poner al día de golpe o a trozos da el mismo resultado', () => {
    const s = idle({ dealers: [shady(30)], storage: { hierba: 100000 } })
    const whole = syncIdle(s, T0 + 2 * 3_600_000)
    let step = s
    for (let t = T0 + 600_000; t <= T0 + 2 * 3_600_000; t += 600_000) step = syncIdle(step, t)
    expect(step.dirtyCash).toBe(whole.dirtyCash)
    expect(step.dealers[0].stolen).toBe(whole.dealers[0].stolen)
  })

  it('los camellos dan el 25 % de la reputación por unidad', () => {
    const r = syncIdle(idle({ dealers: [{ ...shady(100) }], storage: { hierba: 10 } }), T0 + 60_000) // 2 ventas de hierba
    expect(r.repDelta).toBeCloseTo(2 * 1 * 0.25)
  })

  it('un camello antiguo sin fiabilidad guardada recibe una determinista', () => {
    expect(honestyOf({ id: 'x', poiId: 'p', kind: 'park', name: null })).toBe(honestyOf({ id: 'x', poiId: 'p', kind: 'park', name: null }))
    const h = rollHonesty('cualquiera')
    expect(h).toBeGreaterThanOrEqual(30)
    expect(h).toBeLessThanOrEqual(90)
  })
})

describe('blanqueo', () => {
  it('convierte sucio en limpio con comisión del 20 %', () => {
    const s = idle({ dirtyCash: 1000, businesses: [{ poiId: 'n/1', name: null }] })
    const r = syncIdle(s, T0 + 100_000) // 10 ticks x 5
    expect(r.dirtyCash).toBe(950)
    expect(r.cleanCash).toBe(40)
  })
  it('no blanquea más de lo que tienes', () => {
    const s = idle({ dirtyCash: 10, businesses: [{ poiId: 'n/1', name: null }] })
    const r = syncIdle(s, T0 + 3_600_000)
    expect(r.dirtyCash).toBe(0)
    expect(r.cleanCash).toBe(8)
  })
})
