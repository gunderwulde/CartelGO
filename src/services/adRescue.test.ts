import { describe, expect, it } from 'vitest'
import { AD_COOLDOWN_MS, canOfferAd } from './adRescue'

describe('canOfferAd', () => {
  const now = 10_000_000
  it('se ofrece cuando te falta sucio y limpio', () => {
    expect(canOfferAd(10, 20, 0, now)).toBe(true)
  })
  it('no se ofrece si tienes dinero sucio o limpio suficiente', () => {
    expect(canOfferAd(500, 0, 0, now)).toBe(false)
    expect(canOfferAd(0, 400, 0, now)).toBe(false)
  })
  it('respeta la espera entre anuncios', () => {
    expect(canOfferAd(0, 0, now - AD_COOLDOWN_MS + 1, now)).toBe(false)
    expect(canOfferAd(0, 0, now - AD_COOLDOWN_MS, now)).toBe(true)
  })
})
