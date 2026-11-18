import { describe, expect, it } from 'vitest'
import { FAVOR_MS, favorCost } from './favors'

describe('favorCost', () => {
  it('1 favor por cada 5 minutos, redondeando hacia arriba, mínimo 1', () => {
    expect(favorCost(1)).toBe(1)
    expect(favorCost(FAVOR_MS)).toBe(1)
    expect(favorCost(FAVOR_MS + 1)).toBe(2)
    expect(favorCost(2 * 60 * 60_000)).toBe(24)
  })
})
