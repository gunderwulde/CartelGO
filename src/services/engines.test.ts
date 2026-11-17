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
