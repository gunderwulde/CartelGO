import { describe, expect, it } from 'vitest'
import { fullKey, isPristine, isSaveBlob, planSync, progressKey, summarize, type SaveBlob } from './cloudPlan'

const blob = (over: Partial<SaveBlob['base']> = {}): SaveBlob => ({
  v: 1,
  inventory: { dirtyCash: 10, cleanCash: 350, heat: 0 },
  base: {
    hqLevel: 1,
    labLevel: 1,
    storageLevel: 1,
    storage: {},
    job: null,
    dealers: [],
    businesses: [],
    visited: {},
    reputation: 0,
    dealersAt: 1,
    launderAt: 1,
    ...over,
  },
})

describe('planSync', () => {
  const base = { hasServer: true, serverRevision: 5, metaRevision: 5, dirty: false, pristine: false }

  it('sin partida en el servidor, sube la local', () => {
    expect(planSync({ ...base, hasServer: false })).toBe('push')
  })
  it('al día y sin cambios no hace nada', () => {
    expect(planSync(base)).toBe('noop')
  })
  it('al día pero con progreso local, sube', () => {
    expect(planSync({ ...base, dirty: true })).toBe('push')
  })
  it('el servidor avanzó y lo local no cambió: descarga', () => {
    expect(planSync({ ...base, serverRevision: 7 })).toBe('pull')
  })
  it('cambiaron los dos lados: pregunta', () => {
    expect(planSync({ ...base, serverRevision: 7, dirty: true })).toBe('ask')
  })
  it('dispositivo nuevo con partida sin estrenar: descarga sin preguntar', () => {
    expect(planSync({ ...base, metaRevision: null, pristine: true })).toBe('pull')
  })
  it('dispositivo nuevo con progreso propio: pregunta, nunca pisa', () => {
    expect(planSync({ ...base, metaRevision: null, pristine: false })).toBe('ask')
  })
  it('servidor por detrás de lo conocido: manda lo local', () => {
    expect(planSync({ ...base, serverRevision: 2 })).toBe('push')
  })
})

describe('huellas y resumen', () => {
  it('progressKey ignora los cursores del motor idle', () => {
    expect(progressKey(blob({ dealersAt: 1 }))).toBe(progressKey(blob({ dealersAt: 999, launderAt: 999 })))
    expect(fullKey(blob({ dealersAt: 1 }))).not.toBe(fullKey(blob({ dealersAt: 999 })))
  })
  it('progressKey cambia con reputación o mejoras', () => {
    expect(progressKey(blob({ reputation: 50 }))).not.toBe(progressKey(blob()))
    expect(progressKey(blob({ labLevel: 2 }))).not.toBe(progressKey(blob()))
  })
  it('isPristine solo para partidas sin estrenar', () => {
    expect(isPristine(blob())).toBe(true)
    expect(isPristine(blob({ reputation: 1 }))).toBe(false)
  })
  it('summarize redondea', () => {
    expect(summarize(blob({ reputation: 12.6 })).reputation).toBe(13)
  })
})

describe('isSaveBlob', () => {
  it('acepta una partida válida y rechaza basura', () => {
    expect(isSaveBlob(blob())).toBe(true)
    expect(isSaveBlob(null)).toBe(false)
    expect(isSaveBlob({ v: 2 })).toBe(false)
    expect(isSaveBlob({ v: 1, inventory: {}, base: {} })).toBe(false)
  })
})
