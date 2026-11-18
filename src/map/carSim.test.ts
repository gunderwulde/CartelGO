import { describe, expect, it } from 'vitest'
import { CARRIER_LEVELS } from '../data/supply'
import type { Carrier } from '../services/supplyEngine'
import { carPose } from './carSim'

const hq = { lat: 0, lng: 0 }
const point = { lat: 0, lng: 10 }
const arriveAt = 1_000_000
const carrier: Carrier = {
  id: 'c',
  level: 1,
  freeAt: 0,
  trip: { supplierId: 'a', item: 'quimicos', qty: 5, arriveAt },
}
const total = CARRIER_LEVELS[0].tripMs

describe('carPose', () => {
  it('sin viaje no hay coche', () => {
    expect(carPose({ ...carrier, trip: null }, point, hq, 0)).toBeNull()
  })
  it('sale del HQ, llega al punto a mitad del viaje y vuelve cargado', () => {
    const start = carPose(carrier, point, hq, arriveAt - total)
    expect(start?.lng).toBeCloseTo(0)
    expect(start?.loaded).toBe(false)
    const half = carPose(carrier, point, hq, arriveAt - total / 2)
    expect(half?.lng).toBeCloseTo(10)
    const back = carPose(carrier, point, hq, arriveAt - total / 4)
    expect(back?.lng).toBeCloseTo(5)
    expect(back?.loaded).toBe(true)
    expect(back?.east).toBe(false)
  })
})
